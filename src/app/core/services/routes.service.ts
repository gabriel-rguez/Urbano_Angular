import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, firstValueFrom, forkJoin, map, of, switchMap, tap, throwError } from 'rxjs';
import { HttpClient, HttpErrorResponse, HttpContext } from '@angular/common/http';
import { SKIP_AUTH } from '../interceptors/auth.interceptor';
import { environment } from '../../../environments/environment';
import { PlannedRoute, RouteStatus, Vehicle, ChargingStation } from '../models/routes.model';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class RoutesService {
  private readonly API_URL = environment.apiUrl;
  private readonly SEEN_KEY = 'fleet_first_seen_routes';

  private routesSubject = new BehaviorSubject<PlannedRoute[]>([]);
  readonly routes$ = this.routesSubject.asObservable();

  private vehiclesSubject = new BehaviorSubject<Vehicle[]>([]);
  readonly vehicles$ = this.vehiclesSubject.asObservable();

  private stationsSubject = new BehaviorSubject<ChargingStation[]>([]);
  readonly stations$ = this.stationsSubject.asObservable();

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    this.authService.currentUser$.pipe(
      switchMap(() => this.fetchRoutesFromBackend().pipe(
        catchError((err) => {
          console.warn('No se pudieron cargar las rutas:', err);
          return of([] as PlannedRoute[]);
        })
      ))
    ).subscribe();
  }

  setRoutes(routes: PlannedRoute[]) {
    this.routesSubject.next(routes);
  }

  setVehicles(vehicles: Vehicle[]) {
    this.vehiclesSubject.next(vehicles);
  }

  setStations(stations: ChargingStation[]) {
    this.stationsSubject.next(stations);
  }

  getCurrentRoutes(): PlannedRoute[] {
    return this.routesSubject.getValue();
  }

  getCurrentVehicles(): Vehicle[] {
    return this.vehiclesSubject.getValue();
  }

  getCurrentStations(): ChargingStation[] {
    return this.stationsSubject.getValue();
  }

  addStation(station: ChargingStation) {
    this.stationsSubject.next([...this.getCurrentStations(), station]);
  }

  updateStation(updatedStation: ChargingStation) {
    this.stationsSubject.next(
      this.getCurrentStations().map(s => s.id === updatedStation.id ? updatedStation : s)
    );
  }

  deleteStation(stationId: number) {
    this.stationsSubject.next(this.getCurrentStations().filter(s => s.id !== stationId));
  }

  async refreshData(): Promise<{ routes: PlannedRoute[]; vehicles: Vehicle[]; stations: ChargingStation[] }> {
    await firstValueFrom(this.fetchRoutesFromBackend().pipe(catchError(() => of([]))));
    return {
      routes: this.cloneRoutes(this.routesSubject.getValue()),
      vehicles: this.cloneVehicles(this.vehiclesSubject.getValue()),
      stations: this.cloneStations(this.stationsSubject.getValue())
    };
  }

  fetchRoutesFromBackend(): Observable<PlannedRoute[]> {
    return forkJoin({
      rutas: this.http.get<any[]>(`${this.API_URL}/Ruta/v1/listar/mapa`, { context: new HttpContext().set(SKIP_AUTH, true) }),
      paradas: this.http.get<any[]>(`${this.API_URL}/Parada/v1/listar/mapa`, { context: new HttpContext().set(SKIP_AUTH, true) }).pipe(catchError(() => of([])))
    }).pipe(
      map(({ rutas, paradas }) => (rutas || []).map((r: any) => this.mapRoute(r, paradas || []))),
      tap(mapped => {
        this.rememberExistingRouteIds(mapped);
        this.routesSubject.next(mapped);
      }),
      catchError((err: HttpErrorResponse) => {
        console.warn('Backend Ruta/v1 no disponible:', err);
        this.routesSubject.next([]);
        return throwError(() => new Error(err.error?.mensage || err.error?.error || 'No se pudieron cargar las rutas'));
      })
    );
  }

  createRoute(route: Omit<PlannedRoute, 'id'>): Observable<PlannedRoute> {
    const payload = {
      nombre: route.nombre,
      descripcion: `${route.origen || ''} ${route.destino || ''}`.trim(),
      recorrido: (route.polyline || []).map((point, index) => ({
        latitud: point[0],
        longitud: point[1],
        orden: index + 1
      }))
    };

    return this.http.post<any>(`${this.API_URL}/Ruta/v1/registrar`, payload).pipe(
      switchMap(() => this.fetchRoutesFromBackend()),
      map(routes => {
        const saved = routes.find(r => r.nombre === route.nombre) || { ...route, id: Date.now() };
        this.markRouteCreated(saved.id);
        return saved;
      }),
      catchError((err: HttpErrorResponse) =>
        throwError(() => new Error(err.error?.mensage || err.error?.error || 'No se pudo registrar la ruta'))
      )
    );
  }

  createStop(rutaId: number, stop: { nombre: string; lat: number; lng: number }): Observable<unknown> {
    const payload = {
      rutaID: rutaId,
      nombre: stop.nombre,
      latitud: stop.lat,
      longitud: stop.lng
    };
    return this.http.post(`${this.API_URL}/Parada/v1/registrar`, payload).pipe(
      tap(() => this.fetchRoutesFromBackend().subscribe()),
      catchError((err: HttpErrorResponse) =>
        throwError(() => new Error(err.error?.mensage || err.error?.error || 'No se pudo registrar la parada'))
      )
    );
  }

  deleteRoute(id: number): Observable<void> {
    return this.http.delete(`${this.API_URL}/Ruta/v1/eliminar/${id}`, {
      params: { deleteParadas: true }
    }).pipe(
      tap(() => {
        const remaining = this.routesSubject.getValue().filter(r => r.id !== id);
        this.routesSubject.next(remaining);
        this.forgetRoute(id);
      }),
      map(() => void 0),
      catchError((err: HttpErrorResponse) =>
        throwError(() => new Error(err.error?.mensage || err.error?.error || 'No se pudo eliminar la ruta'))
      )
    );
  }

  private mapRoute(r: any, paradasMapa: any[]): PlannedRoute {
    const recorrido = [...(r.recorrido || [])].sort((a: any, b: any) => (a.orden || 0) - (b.orden || 0));
    let polyline: Array<[number, number]> = recorrido
      .map((p: any) => {
        const lat = Number(p.latitud ?? p.lat ?? p.latitude);
        const lng = Number(p.longitud ?? p.lng ?? p.lon ?? p.longitude);
        return [lat, lng] as [number, number];
      })
      .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0));

    const paradas = (r.paradas || []).map((p: any) => {
      const geo = paradasMapa.find((g: any) => g.id === p.id || g.nombre === p.nombre);
      const lat = Number(p.latitud ?? geo?.latitud ?? p.lat ?? 0);
      const lng = Number(p.longitud ?? geo?.longitud ?? p.lng ?? 0);
      return {
        id: p.id,
        nombre: p.nombre || 'Parada',
        lat,
        lng
      };
    }).filter((p: any) => p.lat !== 0 || p.lng !== 0);

    if (polyline.length < 2 && paradas.length >= 2) {
      polyline = paradas.map((stop: { lat: number; lng: number }) => [stop.lat, stop.lng] as [number, number]);
    }

    return {
      id: r.id,
      nombre: r.nombre || 'Ruta sin nombre',
      origen: paradas[0]?.nombre || r.descripcion || 'Origen',
      destino: paradas[paradas.length - 1]?.nombre || 'Destino',
      estado: (r.estado as RouteStatus) || 'Activa',
      color: r.color || '#efb810',
      polyline,
      paradas
    };
  }

  getWeeklyCreatedCount(): number {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const fromSeen = Object.values(this.readSeen()).filter(iso => new Date(iso).getTime() >= weekAgo).length;
    const fromAudit = this.countAuditCreatesThisWeek(weekAgo);
    return Math.max(fromSeen, fromAudit);
  }

  private countAuditCreatesThisWeek(weekAgo: number): number {
    try {
      const raw = localStorage.getItem('audit_logs');
      if (!raw) {
        return 0;
      }
      const logs = JSON.parse(raw) as Array<{ action?: string; category?: string; timestamp?: string }>;
      return logs.filter(log =>
        log.action === 'CREAR' &&
        log.category === 'RUTA' &&
        log.timestamp &&
        new Date(log.timestamp).getTime() >= weekAgo
      ).length;
    } catch {
      return 0;
    }
  }

  private markRouteCreated(id: number) {
    const seen = this.readSeen();
    seen[String(id)] = new Date().toISOString();
    this.writeSeen(seen);
  }

  private rememberExistingRouteIds(routes: PlannedRoute[]) {
    const seen = this.readSeen();
    const oldStamp = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    routes.forEach(route => {
      if (route.id != null && !seen[String(route.id)]) {
        seen[String(route.id)] = oldStamp;
      }
    });
    this.writeSeen(seen);
  }

  private forgetRoute(id: number) {
    const seen = this.readSeen();
    delete seen[String(id)];
    this.writeSeen(seen);
  }

  private readSeen(): Record<string, string> {
    try {
      const raw = localStorage.getItem(this.SEEN_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {
      // ignore
    }
    return {};
  }

  private writeSeen(data: Record<string, string>) {
    localStorage.setItem(this.SEEN_KEY, JSON.stringify(data));
  }

  private cloneRoutes(routes: PlannedRoute[]): PlannedRoute[] {
    return routes.map(route => ({
      ...route,
      polyline: route.polyline.map(point => [point[0], point[1]] as [number, number]),
      paradas: (route.paradas ?? []).map(stop => ({ ...stop }))
    }));
  }

  private cloneVehicles(vehicles: Vehicle[]): Vehicle[] {
    return vehicles.map(vehicle => ({ ...vehicle }));
  }

  private cloneStations(stations: ChargingStation[]): ChargingStation[] {
    return stations.map(station => ({ ...station }));
  }
}
