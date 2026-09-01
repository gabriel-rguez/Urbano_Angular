import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, forkJoin, map, of, switchMap, tap, throwError } from 'rxjs';
import { HttpClient, HttpErrorResponse, HttpContext } from '@angular/common/http';
import { SKIP_AUTH } from '../interceptors/auth.interceptor';
import { environment } from '../../../environments/environment';
import { AuditService } from './audit.service';
import { AuthService } from './auth.service';
import { DriverVehicleStatus, telemetryEstadoIndex } from '../utils/vehicle-status';

export interface Driver {
  id: number;
  ci: string;
  usuarioId?: string;
  nombreCompleto: string;
  telefono: string;
  email: string;
  categorias: string[];
  fechaNacimiento?: string;
  direccion?: string;
  vehiculoId: number | null;
}

export interface FleetVehicle {
  id: number;
  matricula: string;
  marca: string;
  modelo: string;
  tipo: string;
  estado: string;
  ano?: number;
  capacidad?: number;
  conductorId: number | null;
  imeiDispositivoGps?: string | null;
}

export interface DriverChangePayload {
  vehicleId: number;
  incomingDriverId: number | null;
  outgoingDriverId: number | null;
  incomingDriverName: string | null;
  outgoingDriverName: string | null;
  changedAt: string;
}

export interface WeeklyStats {
  vehicles: number;
  drivers: number;
  routes: number;
  trips: number;
}

interface AssignmentLite {
  id: number;
  matriculaVehiculo?: string;
  conductor?: string;
  dniConductor?: string;
  fechaInicio?: string;
  fechaFinal?: string;
  indefinido?: boolean;
}

interface FirstSeenMap {
  vehicles: Record<string, string>;
  drivers: Record<string, string>;
}

@Injectable({
  providedIn: 'root'
})
export class FleetService {
  private readonly API_URL = environment.apiUrl;
  private readonly AUTH_URL = environment.authUrl;
  private readonly FIRST_SEEN_KEY = 'fleet_first_seen';

  private readonly licenseToBackend: Record<string, string> = {
    'A-1': 'A1',
    'C-1': 'C1',
    'D-1': 'D1',
    'F-E': 'FE'
  };

  private readonly licenseToFrontend: Record<string, string> = {
    A1: 'A-1',
    C1: 'C-1',
    D1: 'D-1',
    FE: 'F-E'
  };

  private driversSubject = new BehaviorSubject<Driver[]>([]);
  private vehiclesSubject = new BehaviorSubject<FleetVehicle[]>([]);
  private assignments: AssignmentLite[] = [];

  readonly drivers$ = this.driversSubject.asObservable();
  readonly vehicles$ = this.vehiclesSubject.asObservable();

  constructor(
    private http: HttpClient,
    private auditService: AuditService,
    private authService: AuthService
  ) {
    this.authService.currentUser$.pipe(
      switchMap(() => this.refreshDataFromBackend().pipe(
        catchError((err) => {
          console.warn('No se pudo cargar la flota desde el backend:', err);
          return of({ vehicles: this.vehiclesSubject.getValue(), drivers: this.driversSubject.getValue() });
        })
      ))
    ).subscribe();
  }

  refreshDataFromBackend(): Observable<{ vehicles: FleetVehicle[]; drivers: Driver[] }> {
    return forkJoin({
      vehicles: this.http.get<any[]>(`${this.API_URL}/Vehiculo/v1/listartodo`, { context: new HttpContext().set(SKIP_AUTH, true) }).pipe(
        catchError((err: HttpErrorResponse) => throwError(() => this.toUserError(err, 'No se pudieron cargar los vehículos')))
      ),
      drivers: this.http.get<any[]>(`${this.API_URL}/Conductor/v1/listar`, { context: new HttpContext().set(SKIP_AUTH, true) }).pipe(
        catchError(() => of([] as any[]))
      ),
      assignments: this.http.get<AssignmentLite[]>(`${this.API_URL}/Asignacion/v1/listar`, { context: new HttpContext().set(SKIP_AUTH, true) }).pipe(
        catchError(() => of([] as AssignmentLite[]))
      )
    }).pipe(
      tap(({ vehicles, drivers, assignments }) => {
        const mappedDrivers = (drivers || []).map((d: any) => this.mapDriver(d));
        const mappedVehicles = (vehicles || []).map((v: any) => this.mapVehicle(v));
        this.assignments = assignments || [];
        this.linkAssignments(mappedVehicles, mappedDrivers, this.assignments);
        this.rememberExistingIds(mappedVehicles, mappedDrivers);
        this.vehiclesSubject.next(mappedVehicles);
        this.driversSubject.next(mappedDrivers);
      }),
      map(({ vehicles, drivers }) => ({
        vehicles: this.vehiclesSubject.getValue(),
        drivers: this.driversSubject.getValue(),
        rawVehicles: vehicles,
        rawDrivers: drivers
      })),
      catchError((err) => {
        console.warn('Backend de flota no disponible:', err);
        return throwError(() => err);
      })
    );
  }

  fetchVehicles(): Observable<FleetVehicle[]> {
    return this.refreshDataFromBackend().pipe(map(res => res.vehicles));
  }

  fetchDrivers(): Observable<Driver[]> {
    return this.refreshDataFromBackend().pipe(map(res => res.drivers));
  }

  addDriver(driver: Omit<Driver, 'id' | 'vehiculoId'>): Observable<Driver> {
    const names = this.splitName(driver.nombreCompleto);
    const email = (driver.email || '').trim().toLowerCase();
    const accountPayload = {
      nombreUsuario: email,
      password: driver.ci,
      email,
      dni: driver.ci,
      nombre: names.nombre,
      apellidos: names.apellidos,
      categoriasLicencia: this.toBackendLicenses(driver.categorias),
      disponibilidad: true
    };
    const gestionPayload = {
      dni: driver.ci,
      usuarioId: crypto.randomUUID(),
      nombre: names.nombre,
      apellidos: names.apellidos,
      categoriasLicencia: this.toBackendLicenses(driver.categorias),
      disponibilidad: true,
      email,
      telefono: driver.telefono,
      direccion: driver.direccion
    };

    return this.http.post(`${this.AUTH_URL}/registrar-driver`, accountPayload).pipe(
      catchError((err: HttpErrorResponse) => {
        if (err.status === 404 || err.status === 403 || err.status === 409) {
          return of(null);
        }
        return throwError(() => this.toUserError(err, 'No se pudo crear la cuenta del conductor'));
      }),
      switchMap(() => this.http.post<any>(`${this.API_URL}/Conductor/v1/registrar`, gestionPayload).pipe(
        catchError((err: HttpErrorResponse) => {
          if (err.status === 409 || err.status === 400) {
            return of(null);
          }
          return throwError(() => this.toUserError(err, 'No se pudo registrar el conductor'));
        })
      )),
      switchMap(() => this.refreshDataFromBackend()),
      map(() => {
        const created = this.driversSubject.getValue().find(d => d.ci === driver.ci);
        if (!created) {
          throw new Error('El conductor se registró pero no aparece en el listado.');
        }
        this.markCreated('drivers', created.id);
        this.auditService.logAction('CREAR', 'CONDUCTOR', `Conductor agregado: ${created.nombreCompleto} (CI: ${created.ci})`);
        return created;
      }),
      catchError((err: HttpErrorResponse | Error) => throwError(() => this.toUserError(err, 'No se pudo registrar el conductor')))
    );
  }

  updateDriver(updatedDriver: Driver): Observable<Driver> {
    const names = this.splitName(updatedDriver.nombreCompleto);
    const payload = {
      dni: updatedDriver.ci,
      nombre: names.nombre,
      apellidos: names.apellidos,
      categoriasLicencia: this.toBackendLicenses(updatedDriver.categorias),
      disponibilidad: true,
      email: (updatedDriver.email || '').trim().toLowerCase(),
      telefono: updatedDriver.telefono,
      direccion: updatedDriver.direccion
    };

    return this.http.patch(`${this.API_URL}/Conductor/v1/actualizar/${updatedDriver.id}`, payload).pipe(
      switchMap(() => this.refreshDataFromBackend()),
      tap(() => this.auditService.logAction('ACTUALIZAR', 'CONDUCTOR', `Conductor actualizado: ${updatedDriver.nombreCompleto}`)),
      map(() => this.driversSubject.getValue().find(d => d.id === updatedDriver.id) || updatedDriver),
      catchError((err: HttpErrorResponse) => throwError(() => this.toUserError(err, 'No se pudo actualizar el conductor')))
    );
  }

  deleteDriver(driverId: number): Observable<void> {
    const driver = this.driversSubject.getValue().find(d => d.id === driverId);
    return this.http.delete(`${this.API_URL}/Conductor/v1/eliminar/${driverId}`).pipe(
      switchMap(() => this.refreshDataFromBackend()),
      tap(() => {
        if (driver) {
          this.auditService.logAction('ELIMINAR', 'CONDUCTOR', `Conductor eliminado: ${driver.nombreCompleto}`);
        }
      }),
      map(() => void 0),
      catchError((err: HttpErrorResponse) => throwError(() => this.toUserError(err, 'No se pudo eliminar el conductor')))
    );
  }

  addVehicle(vehicle: Omit<FleetVehicle, 'id' | 'conductorId'>): Observable<FleetVehicle> {
    const payload = {
      matricula: (vehicle.matricula || '').trim().toUpperCase(),
      marca: vehicle.marca,
      modelo: vehicle.modelo,
      tipoBateria: vehicle.tipo,
      estado: 'ACTIVO',
      capacidadPersonas: vehicle.capacidad || 4
    };

    return this.http.post<any>(`${this.API_URL}/Vehiculo/v1/registrar`, payload).pipe(
      switchMap(() => this.refreshDataFromBackend()),
      map(() => {
        const created = this.vehiclesSubject.getValue().find(v => v.matricula.toUpperCase() === payload.matricula);
        if (!created) {
          throw new Error('El vehículo se registró pero no aparece en el listado.');
        }
        this.markCreated('vehicles', created.id);
        this.auditService.logAction('CREAR', 'VEHICULO', `Vehículo agregado: ${created.marca} ${created.modelo} (${created.matricula})`);
        return created;
      }),
      catchError((err: HttpErrorResponse) => throwError(() => this.toUserError(err, 'No se pudo registrar el vehículo')))
    );
  }

  updateVehicle(updatedVehicle: FleetVehicle): Observable<FleetVehicle> {
    const payload = {
      matricula: (updatedVehicle.matricula || '').trim().toUpperCase(),
      marca: updatedVehicle.marca,
      modelo: updatedVehicle.modelo,
      tipoBateria: updatedVehicle.tipo,
      capacidadPersonas: updatedVehicle.capacidad || 4
    };

    return this.http.patch(`${this.API_URL}/Vehiculo/v1/actualizar/${updatedVehicle.id}`, payload).pipe(
      switchMap(() => this.refreshDataFromBackend()),
      tap(() => this.auditService.logAction('ACTUALIZAR', 'VEHICULO', `Vehículo actualizado: ${updatedVehicle.matricula}`)),
      map(() => this.vehiclesSubject.getValue().find(v => v.id === updatedVehicle.id) || updatedVehicle),
      catchError((err: HttpErrorResponse) => throwError(() => this.toUserError(err, 'No se pudo actualizar el vehículo')))
    );
  }

  deleteVehicle(vehicleId: number): Observable<void> {
    const vehicle = this.vehiclesSubject.getValue().find(v => v.id === vehicleId);
    return this.http.delete(`${this.API_URL}/Vehiculo/v1/eliminar/${vehicleId}`).pipe(
      switchMap(() => this.refreshDataFromBackend()),
      tap(() => {
        if (vehicle) {
          this.auditService.logAction('ELIMINAR', 'VEHICULO', `Vehículo eliminado: ${vehicle.matricula}`);
        }
      }),
      map(() => void 0),
      catchError((err: HttpErrorResponse) => throwError(() => this.toUserError(err, 'No se pudo eliminar el vehículo')))
    );
  }

  assignVehicleToDriver(driverId: number, vehicleId: number | null): Observable<unknown> {
    return this.applyAssignment(driverId, vehicleId);
  }

  assignDriverToVehicle(vehicleId: number, driverId: number | null): Observable<unknown> {
    return this.applyAssignment(driverId, vehicleId);
  }

  getVehicles(): FleetVehicle[] {
    return this.vehiclesSubject.getValue();
  }

  findAssignedVehicle(user: { id?: string; username?: string; email?: string } | null): FleetVehicle | null {
    const driver = this.findDriverForUser(user);
    if (!driver) {
      return null;
    }
    return this.vehiclesSubject.getValue().find(v =>
      v.id === driver.vehiculoId || v.conductorId === driver.id
    ) ?? null;
  }

  updateDriverVehicleStatus(status: DriverVehicleStatus): Observable<FleetVehicle> {
    const user = this.authService.getCurrentUser();
    const vehicle = this.findAssignedVehicle(user);
    const gestion$ = this.http.patch<any>(`${environment.gatewayUrl}/conductor/Vehiculo/v1/estado`, { estado: status });
    const telemetria$ = vehicle
      ? this.http.post(`${environment.telemetriaUrl}/v1/estado/cambiar`, {
          vehiculoId: String(vehicle.id),
          nuevoEsatado: telemetryEstadoIndex(status)
        }).pipe(catchError(() => of(null)))
      : of(null);

    return forkJoin({ gestion: gestion$, telemetria: telemetria$ }).pipe(
      switchMap(() => this.refreshDataFromBackend()),
      map(() => {
        const updated = this.findAssignedVehicle(this.authService.getCurrentUser());
        if (!updated) {
          throw new Error('El estado se guardó pero el vehículo no aparece en el listado.');
        }
        this.auditService.logAction('ACTUALIZAR', 'VEHICULO', `Estado operativo: ${updated.matricula} → ${status}`);
        return updated;
      }),
      catchError((err: HttpErrorResponse | Error) => throwError(() => this.toUserError(err, 'No se pudo actualizar el estado del ecomóvil')))
    );
  }

  getWeeklyStats(): WeeklyStats {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const seen = this.readFirstSeen();
    const countRecent = (bucket: Record<string, string>) =>
      Object.values(bucket).filter(iso => new Date(iso).getTime() >= weekAgo).length;

    const trips = this.assignments.filter(a => {
      if (!a.fechaInicio) {
        return false;
      }
      return new Date(a.fechaInicio).getTime() >= weekAgo;
    }).length;

    return {
      vehicles: countRecent(seen.vehicles),
      drivers: countRecent(seen.drivers),
      routes: 0,
      trips
    };
  }

  findDriverForUser(user: { id?: string; username?: string; email?: string } | null): Driver | null {
    if (!user) {
      return null;
    }
    const username = (user.username || '').toLowerCase();
    const email = (user.email || user.username || '').toLowerCase();
    return this.driversSubject.getValue().find(d =>
      (user.id && d.usuarioId === user.id) ||
      (d.email && d.email.toLowerCase() === email) ||
      (d.ci && username.includes(d.ci))
    ) ?? null;
  }

  private applyAssignment(driverId: number | null, vehicleId: number | null): Observable<unknown> {
    if (driverId && vehicleId) {
      const assignmentPayload = {
        vehiculoId: vehicleId,
        conductorId: driverId,
        fechaInicio: new Date().toISOString().split('T')[0],
        indefinido: true
      };
      return this.http.post(`${this.API_URL}/Asignacion/v1`, assignmentPayload).pipe(
        switchMap(() => this.refreshDataFromBackend()),
        tap(() => {
          const drivers = this.driversSubject.getValue();
          const vehicles = this.vehiclesSubject.getValue();
          const driver = drivers.find(d => d.id === driverId);
          const vehicle = vehicles.find(v => v.id === vehicleId);
          if (driver && vehicle) {
            this.auditService.logAction('ACTUALIZAR', 'VEHICULO', `Asignación: ${driver.nombreCompleto} → ${vehicle.matricula}`);
          }
        }),
        catchError((err: HttpErrorResponse) => throwError(() => this.toUserError(err, 'No se pudo guardar la asignación')))
      );
    }

    return this.refreshDataFromBackend();
  }

  private mapVehicle(v: any): FleetVehicle {
    return {
      id: v.id,
      matricula: v.matricula || v.placa || '',
      marca: v.marca || 'Genérica',
      modelo: v.modelo || 'EV',
      tipo: v.tipoBateria || v.tipo || 'Eléctrico',
      estado: v.estado || 'ACTIVO',
      capacidad: v.capacidadPersonas,
      conductorId: v.conductorId ?? null,
      imeiDispositivoGps: v.imeiDispositivoGps || v.imei_dispositivo_gps || null
    };
  }

  private mapDriver(d: any): Driver {
    return {
      id: d.id,
      usuarioId: d.usuarioId,
      ci: d.dni || d.ci || '',
      nombreCompleto: d.nombreCompleto || `${d.nombre || ''} ${d.apellidos || d.apellido || ''}`.trim(),
      telefono: d.telefono || '',
      email: d.email || '',
      direccion: d.direccion || '',
      categorias: this.toFrontendLicenses(d.categoriasLicencia || d.categorias || []),
      vehiculoId: d.vehiculoId ?? null
    };
  }

  private linkAssignments(vehicles: FleetVehicle[], drivers: Driver[], assignments: AssignmentLite[]) {
    vehicles.forEach(v => v.conductorId = null);
    drivers.forEach(d => d.vehiculoId = null);

    assignments.forEach(a => {
      const ended = a.fechaFinal && new Date(a.fechaFinal) < new Date();
      if (ended && !a.indefinido) {
        return;
      }
      const vehicle = vehicles.find(v => v.matricula === a.matriculaVehiculo);
      const driver = drivers.find(d => d.ci === a.dniConductor);
      if (vehicle && driver) {
        vehicle.conductorId = driver.id;
        driver.vehiculoId = vehicle.id;
      }
    });
  }

  private splitName(fullName: string): { nombre: string; apellidos: string } {
    const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
    return {
      nombre: parts[0] || 'Nombre',
      apellidos: parts.slice(1).join(' ') || 'Apellido'
    };
  }

  private toBackendLicenses(codes: string[]): string[] {
    return (codes || []).map(code => this.licenseToBackend[code] || code.replace('-', ''));
  }

  private toFrontendLicenses(codes: string[]): string[] {
    return (codes || []).map(code => this.licenseToFrontend[code] || code);
  }

  private rememberExistingIds(vehicles: FleetVehicle[], drivers: Driver[]) {
    const seen = this.readFirstSeen();
    const seeded = Object.keys(seen.vehicles).length === 0 && Object.keys(seen.drivers).length === 0;
    const stamp = seeded ? new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString() : new Date().toISOString();

    vehicles.forEach(v => {
      if (!seen.vehicles[String(v.id)]) {
        seen.vehicles[String(v.id)] = stamp;
      }
    });
    drivers.forEach(d => {
      if (!seen.drivers[String(d.id)]) {
        seen.drivers[String(d.id)] = stamp;
      }
    });
    this.writeFirstSeen(seen);
  }

  private markCreated(kind: 'vehicles' | 'drivers', id: number) {
    const seen = this.readFirstSeen();
    seen[kind][String(id)] = new Date().toISOString();
    this.writeFirstSeen(seen);
  }

  private readFirstSeen(): FirstSeenMap {
    try {
      const raw = localStorage.getItem(this.FIRST_SEEN_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {
      // ignore corrupt storage
    }
    return { vehicles: {}, drivers: {} };
  }

  private writeFirstSeen(data: FirstSeenMap) {
    localStorage.setItem(this.FIRST_SEEN_KEY, JSON.stringify(data));
  }

  private toUserError(err: HttpErrorResponse | Error, fallback: string): Error {
    const body = (err as HttpErrorResponse)?.error;
    const message = body?.mensage || body?.message || body?.error || (err as Error)?.message || fallback;
    return new Error(typeof message === 'string' ? message : fallback);
  }
}
