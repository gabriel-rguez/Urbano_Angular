import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LayoutComponent } from '../../shared/layout/layout.component';
import { FleetService, Driver, FleetVehicle } from '../../core/services/fleet.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-vehiculos',
  standalone: true,
  imports: [CommonModule, FormsModule, LayoutComponent],
  templateUrl: './vehiculos.component.html',
  styleUrl: './vehiculos.component.css'
})
export class VehiculosComponent implements OnInit, OnDestroy {
  vehicles: FleetVehicle[] = [];
  drivers: Driver[] = [];

  newVehicle = {
    matricula: '',
    marca: '',
    modelo: '',
    tipo: ''
  };

  private subscriptions = new Subscription();

  constructor(private fleetService: FleetService) {}

  ngOnInit(): void {
    this.subscriptions.add(
      this.fleetService.vehicles$.subscribe(vehicles => (this.vehicles = vehicles))
    );
    this.subscriptions.add(
      this.fleetService.drivers$.subscribe(drivers => (this.drivers = drivers))
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  onSubmit() {
    console.log('Registrar vehículo:', this.newVehicle);
    alert('Vehículo registrado (solo vista)');
    this.resetForm();
  }

  resetForm() {
    this.newVehicle = {
      matricula: '',
      marca: '',
      modelo: '',
      tipo: ''
    };
  }

  assignDriver(vehicle: FleetVehicle, driverValue: string) {
    const driverId = driverValue ? Number(driverValue) : null;

    if (vehicle.conductorId === driverId) {
      return;
    }

    const currentDriver = vehicle.conductorId
      ? this.drivers.find(d => d.id === vehicle.conductorId) ?? null
      : null;
    const nextDriver = driverId ? this.drivers.find(d => d.id === driverId) ?? null : null;

    if (!this.confirmDriverChange(vehicle, currentDriver, nextDriver)) {
      return;
    }

    this.fleetService.assignDriverToVehicle(vehicle.id, driverId);
  }

  private confirmDriverChange(
    vehicle: FleetVehicle,
    currentDriver: Driver | null,
    nextDriver: Driver | null
  ): boolean {
    const vehicleLabel = `${vehicle.marca} ${vehicle.modelo} (${vehicle.matricula})`;
    const currentLabel = currentDriver ? currentDriver.nombreCompleto : 'Sin conductor asignado';
    const nextLabel = nextDriver ? nextDriver.nombreCompleto : 'Sin conductor';
    const message = [
      `¿Deseas cambiar el conductor del vehículo ${vehicleLabel}?`,
      `Actual: ${currentLabel}`,
      `Nuevo: ${nextLabel}`,
      '',
      'Esta acción registrará la hora del cambio.'
    ].join('\n');

    return confirm(message);
  }

  getDriverLabel(vehicle: FleetVehicle): string {
    const driver = this.drivers.find(d => d.id === vehicle.conductorId);
    return driver ? driver.nombreCompleto : 'Sin conductor';
  }

  editVehicle(vehicle: FleetVehicle) {
    console.log('Editar vehículo:', vehicle);
  }

  deleteVehicle(vehicle: FleetVehicle) {
    if (confirm('¿Estás seguro de eliminar este vehículo?')) {
      console.log('Eliminar vehículo:', vehicle);
    }
  }
}

