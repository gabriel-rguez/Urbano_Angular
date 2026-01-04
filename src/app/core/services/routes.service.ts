import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { PlannedRoute, Vehicle, ChargingStation } from '../models/routes.model';

@Injectable({
  providedIn: 'root'
})
export class RoutesService {
  private routesSubject = new BehaviorSubject<PlannedRoute[]>([]);
  readonly routes$ = this.routesSubject.asObservable();

  private vehiclesSubject = new BehaviorSubject<Vehicle[]>([]);
  readonly vehicles$ = this.vehiclesSubject.asObservable();

  private stationsSubject = new BehaviorSubject<ChargingStation[]>([]);
  readonly stations$ = this.stationsSubject.asObservable();

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
    const current = this.getCurrentStations();
    this.stationsSubject.next([...current, station]);
  }

  updateStation(updatedStation: ChargingStation) {
    const current = this.getCurrentStations();
    const index = current.findIndex(s => s.id === updatedStation.id);
    if (index !== -1) {
      current[index] = updatedStation;
      this.stationsSubject.next([...current]);
    }
  }

  deleteStation(stationId: number) {
    const current = this.getCurrentStations();
    this.stationsSubject.next(current.filter(s => s.id !== stationId));
  }

  /**
   * Re-emite los datos actuales para forzar que los mapas se actualicen.
   * En el futuro puede reemplazarse con una llamada HTTP real al backend.
   */
  async refreshData(): Promise<{ routes: PlannedRoute[]; vehicles: Vehicle[]; stations: ChargingStation[] }> {
    const routesClone = this.cloneRoutes(this.routesSubject.getValue());
    const vehiclesClone = this.cloneVehicles(this.vehiclesSubject.getValue());
    const stationsClone = this.cloneStations(this.stationsSubject.getValue());

    this.routesSubject.next(routesClone);
    this.vehiclesSubject.next(vehiclesClone);
    this.stationsSubject.next(stationsClone);

    return { routes: routesClone, vehicles: vehiclesClone, stations: stationsClone };
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

