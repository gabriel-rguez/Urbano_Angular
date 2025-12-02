import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { PlannedRoute, Vehicle } from '../models/routes.model';

@Injectable({
  providedIn: 'root'
})
export class RoutesService {
  private routesSubject = new BehaviorSubject<PlannedRoute[]>([]);
  readonly routes$ = this.routesSubject.asObservable();

  private vehiclesSubject = new BehaviorSubject<Vehicle[]>([]);
  readonly vehicles$ = this.vehiclesSubject.asObservable();

  setRoutes(routes: PlannedRoute[]) {
    this.routesSubject.next(routes);
  }

  setVehicles(vehicles: Vehicle[]) {
    this.vehiclesSubject.next(vehicles);
  }

  getCurrentRoutes(): PlannedRoute[] {
    return this.routesSubject.getValue();
  }

  getCurrentVehicles(): Vehicle[] {
    return this.vehiclesSubject.getValue();
  }

  /**
   * Re-emite los datos actuales para forzar que los mapas se actualicen.
   * En el futuro puede reemplazarse con una llamada HTTP real al backend.
   */
  async refreshData(): Promise<{ routes: PlannedRoute[]; vehicles: Vehicle[] }> {
    const routesClone = this.cloneRoutes(this.routesSubject.getValue());
    const vehiclesClone = this.cloneVehicles(this.vehiclesSubject.getValue());
    this.routesSubject.next(routesClone);
    this.vehiclesSubject.next(vehiclesClone);
    return { routes: routesClone, vehicles: vehiclesClone };
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
}

