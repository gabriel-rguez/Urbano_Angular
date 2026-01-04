import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AuditService } from './audit.service';

export interface Driver {
  id: number;
  ci: string;
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
}

export interface DriverChangePayload {
  vehicleId: number;
  incomingDriverId: number | null;
  outgoingDriverId: number | null;
  incomingDriverName: string | null;
  outgoingDriverName: string | null;
  changedAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class FleetService {
  private driversSubject = new BehaviorSubject<Driver[]>([
    {
      id: 1,
      ci: '86051278901',
      nombreCompleto: 'Juan Pérez Rodríguez',
      telefono: '5234567890',
      email: 'juan@example.com',
      categorias: ['B', 'D', 'D-1'],
      vehiculoId: 1
    },
    {
      id: 2,
      ci: '90122345678',
      nombreCompleto: 'María García López',
      telefono: '5367890123',
      email: 'maria@example.com',
      categorias: ['B', 'C', 'D-1'],
      vehiculoId: null
    }
  ]);

  private vehiclesSubject = new BehaviorSubject<FleetVehicle[]>([
    { id: 1, matricula: 'ABC-1234', marca: 'Toyota', modelo: 'Prius', tipo: 'Híbrido (NiMH)', estado: 'Activo', conductorId: 1 },
    { id: 2, matricula: 'XYZ-5678', marca: 'Tesla', modelo: 'Model 3', tipo: 'Fosfato de Hierro y Litio (LFP)', estado: 'Activo', conductorId: null },
    { id: 3, matricula: 'DEF-9012', marca: 'BYD', modelo: 'Seal', tipo: 'Blade Battery (LFP)', estado: 'Mantenimiento', conductorId: null }
  ]);

  readonly drivers$ = this.driversSubject.asObservable();
  readonly vehicles$ = this.vehiclesSubject.asObservable();

  constructor(private auditService: AuditService) { }

  addDriver(driver: Omit<Driver, 'id' | 'vehiculoId'>) {
    const drivers = [...this.driversSubject.getValue()];
    const newDriver: Driver = {
      ...driver,
      id: Date.now(),
      vehiculoId: null
    };
    drivers.unshift(newDriver);
    this.driversSubject.next(drivers);
    this.auditService.logAction('CREAR', 'CONDUCTOR', `Conductor agregado: ${newDriver.nombreCompleto} (CI: ${newDriver.ci})`);
  }

  updateDriver(updatedDriver: Driver) {
    const drivers = this.driversSubject.getValue().map(d =>
      d.id === updatedDriver.id ? updatedDriver : d
    );
    this.driversSubject.next(drivers);
    this.auditService.logAction('ACTUALIZAR', 'CONDUCTOR', `Conductor actualizado: ${updatedDriver.nombreCompleto}`);
  }

  deleteDriver(driverId: number) {
    const drivers = this.driversSubject.getValue().filter(d => d.id !== driverId);
    const driver = this.driversSubject.getValue().find(d => d.id === driverId);
    this.driversSubject.next(drivers);
    if (driver) {
      this.auditService.logAction('ELIMINAR', 'CONDUCTOR', `Conductor eliminado: ${driver.nombreCompleto}`);
    }

    // Desasignar vehículo si tenía uno
    const vehicles = this.vehiclesSubject.getValue().map(v =>
      v.conductorId === driverId ? { ...v, conductorId: null } : v
    );
    this.vehiclesSubject.next(vehicles);
  }

  addVehicle(vehicle: Omit<FleetVehicle, 'id' | 'conductorId'>) {
    const vehicles = [...this.vehiclesSubject.getValue()];
    const newVehicle: FleetVehicle = {
      ...vehicle,
      id: Date.now(),
      conductorId: null,
      estado: 'Activo'
    };
    vehicles.unshift(newVehicle);
    this.vehiclesSubject.next(vehicles);
    this.auditService.logAction('CREAR', 'VEHICULO', `Vehículo agregado: ${newVehicle.marca} ${newVehicle.modelo} (${newVehicle.matricula})`);
  }

  updateVehicle(updatedVehicle: FleetVehicle) {
    const vehicles = this.vehiclesSubject.getValue().map(v =>
      v.id === updatedVehicle.id ? updatedVehicle : v
    );
    this.vehiclesSubject.next(vehicles);
    this.auditService.logAction('ACTUALIZAR', 'VEHICULO', `Vehículo actualizado: ${updatedVehicle.matricula}`);
  }

  deleteVehicle(vehicleId: number) {
    const vehicles = this.vehiclesSubject.getValue().filter(v => v.id !== vehicleId);
    const vehicle = this.vehiclesSubject.getValue().find(v => v.id === vehicleId);
    this.vehiclesSubject.next(vehicles);
    if (vehicle) {
      this.auditService.logAction('ELIMINAR', 'VEHICULO', `Vehículo eliminado: ${vehicle.matricula}`);
    }

    // Desasignar conductor si tenía uno
    const drivers = this.driversSubject.getValue().map(d =>
      d.vehiculoId === vehicleId ? { ...d, vehiculoId: null } : d
    );
    this.driversSubject.next(drivers);
  }

  assignVehicleToDriver(driverId: number, vehicleId: number | null) {
    this.applyAssignment(driverId, vehicleId);
  }

  assignDriverToVehicle(vehicleId: number, driverId: number | null) {
    this.applyAssignment(driverId, vehicleId);
  }

  private applyAssignment(driverId: number | null, vehicleId: number | null) {
    const drivers = this.cloneDrivers();
    const vehicles = this.cloneVehicles();

    const driver = driverId ? drivers.find(d => d.id === driverId) ?? null : null;
    const vehicle = vehicleId ? vehicles.find(v => v.id === vehicleId) ?? null : null;
    const changeTargets: Array<{ vehicle: FleetVehicle; previousDriverId: number | null }> = [];

    if (vehicle) {
      changeTargets.push({ vehicle, previousDriverId: vehicle.conductorId ?? null });
    }

    if (driver && driver.vehiculoId && driver.vehiculoId !== vehicleId) {
      const previousVehicle = vehicles.find(v => v.id === driver.vehiculoId);
      if (previousVehicle) {
        const alreadyTracked = changeTargets.some(target => target.vehicle.id === previousVehicle.id);
        if (!alreadyTracked) {
          changeTargets.push({
            vehicle: previousVehicle,
            previousDriverId: previousVehicle.conductorId ?? null
          });
        }
        previousVehicle.conductorId = null;
      }
    }

    if (vehicle && vehicle.conductorId && vehicle.conductorId !== driverId) {
      const previousDriver = drivers.find(d => d.id === vehicle.conductorId);
      if (previousDriver) {
        previousDriver.vehiculoId = null;
      }
    }

    if (driver) {
      driver.vehiculoId = vehicle ? vehicle.id : null;
    }

    if (vehicle) {
      vehicle.conductorId = driver ? driver.id : null;
    }

    this.driversSubject.next(drivers);
    this.vehiclesSubject.next(vehicles);
    this.persistDriverChangeEvents(changeTargets, drivers);
  }

  private cloneDrivers(): Driver[] {
    return this.driversSubject.getValue().map(driver => ({
      ...driver,
      categorias: [...driver.categorias],
      vehiculoId: driver.vehiculoId
    }));
  }

  private cloneVehicles(): FleetVehicle[] {
    return this.vehiclesSubject.getValue().map(vehicle => ({ ...vehicle }));
  }

  private persistDriverChangeEvents(
    targets: Array<{ vehicle: FleetVehicle; previousDriverId: number | null }>,
    drivers: Driver[]
  ) {
    targets.forEach(({ vehicle, previousDriverId }) => {
      const newDriverId = vehicle.conductorId ?? null;
      if (newDriverId === previousDriverId) {
        return;
      }

      const payload: DriverChangePayload = {
        vehicleId: vehicle.id,
        incomingDriverId: newDriverId,
        outgoingDriverId: previousDriverId,
        incomingDriverName: newDriverId
          ? (drivers.find(d => d.id === newDriverId)?.nombreCompleto ?? null)
          : null,
        outgoingDriverName: previousDriverId
          ? (drivers.find(d => d.id === previousDriverId)?.nombreCompleto ?? null)
          : null,
        changedAt: new Date().toISOString()
      };

      this.sendDriverChangeToDatabase(payload);
    });
  }

  private sendDriverChangeToDatabase(payload: DriverChangePayload) {
    // Aquí se podría realizar la llamada HTTP real hacia la API/BD.
    console.log('Registro de cambio de conductor listo para guardar:', payload);

    let message = '';
    if (payload.incomingDriverName && payload.outgoingDriverName) {
      message = `Cambio de conductor en ${payload.vehicleId}: Sale ${payload.outgoingDriverName}, entra ${payload.incomingDriverName}`;
    } else if (payload.incomingDriverName) {
      message = `Asignación de conductor en ${payload.vehicleId}: ${payload.incomingDriverName}`;
    } else if (payload.outgoingDriverName) {
      message = `Desasignación de conductor en ${payload.vehicleId}: Sale ${payload.outgoingDriverName}`;
    }

    if (message) {
      this.auditService.logAction('ACTUALIZAR', 'VEHICULO', message);
    }
  }
}


