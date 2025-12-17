import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { LayoutComponent } from '../../shared/layout/layout.component';
import { FleetService, Driver, FleetVehicle } from '../../core/services/fleet.service';
import { ConfirmationService } from '../../core/services/confirmation.service';
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

  constructor(
    private fleetService: FleetService,
    private confirmationService: ConfirmationService
  ) { }

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

  isEditing = false;
  editingId: number | null = null;
  formSuccess: string | null = null;

  @ViewChild('vehicleForm') vehicleForm!: NgForm;
  formError: string | null = null;

  async onSubmit() {
    this.formError = null;
    this.formSuccess = null;

    if (this.vehicleForm.invalid) {
      this.vehicleForm.control.markAllAsTouched();

      const missingFields: string[] = [];
      if (this.vehicleForm.controls['matricula']?.errors) missingFields.push('Matrícula');
      if (this.vehicleForm.controls['marca']?.errors) missingFields.push('Marca');
      if (this.vehicleForm.controls['modelo']?.errors) missingFields.push('Modelo');
      if (this.vehicleForm.controls['tipo']?.errors) missingFields.push('Tipo de Batería');

      this.formError = `Por favor, completa los siguientes campos obligatorios: ${missingFields.join(', ')}.`;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (this.isEditing && this.editingId) {
      await this.confirmUpdate();
    } else {
      this.createVehicle();
    }
  }

  private async confirmUpdate() {
    const confirmed = await this.confirmationService.confirm({
      title: 'Confirmar Edición',
      message: '¿Estás seguro de guardar los cambios para este vehículo?',
      confirmText: 'Guardar Cambios',
      type: 'warning'
    });

    if (confirmed && this.editingId) {
      this.fleetService.updateVehicle({
        id: this.editingId,
        conductorId: this.getVehicleDriverId(this.editingId),
        estado: 'Activo', // Mantener estado o agregar campo
        ...this.newVehicle
      });
      this.formSuccess = 'Vehículo actualizado correctamente.';
      this.cancelEdit();
    }
  }

  private getVehicleDriverId(id: number): number | null {
    const v = this.vehicles.find(veh => veh.id === id);
    return v ? v.conductorId : null;
  }

  private async createVehicle() {
    // Usar modal de confirmación en lugar de alert para mejor UX, o un toast si tuviéramos
    await this.confirmationService.confirm({
      title: 'Vehículo Registrado',
      message: 'El vehículo ha sido registrado correctamente (modo simulación).',
      confirmText: 'Entendido',
      type: 'info'
    });
    this.fleetService.addVehicle({
      ...this.newVehicle,
      estado: 'Activo'
    });
    this.resetForm();
  }

  cancelEdit() {
    this.isEditing = false;
    this.editingId = null;
    this.resetForm();
    this.formSuccess = null;
  }

  resetForm() {
    this.newVehicle = {
      matricula: '',
      marca: '',
      modelo: '',
      tipo: ''
    };
  }

  async assignDriver(vehicle: FleetVehicle, driverValue: string) {
    const driverId = driverValue ? Number(driverValue) : null;

    if (vehicle.conductorId === driverId) {
      return;
    }

    const currentDriver = vehicle.conductorId
      ? this.drivers.find(d => d.id === vehicle.conductorId) ?? null
      : null;
    const nextDriver = driverId ? this.drivers.find(d => d.id === driverId) ?? null : null;

    if (!(await this.confirmDriverChange(vehicle, currentDriver, nextDriver))) {
      // Revertir cambio visual (hack)
      this.vehicles = [...this.vehicles];
      return;
    }

    this.fleetService.assignDriverToVehicle(vehicle.id, driverId);
  }

  private async confirmDriverChange(
    vehicle: FleetVehicle,
    currentDriver: Driver | null,
    nextDriver: Driver | null
  ): Promise<boolean> {
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

    return await this.confirmationService.confirm({
      message,
      title: 'Confirmar cambio de conductor',
      confirmText: 'Asignar',
      type: 'warning'
    });
  }

  getDriverLabel(vehicle: FleetVehicle): string {
    const driver = this.drivers.find(d => d.id === vehicle.conductorId);
    return driver ? driver.nombreCompleto : 'Sin conductor';
  }

  viewVehicle(vehicle: FleetVehicle) {
    const driverLabel = this.getDriverLabel(vehicle);
    const htmlContent = `
      <div class="detail-row">
        <strong>Matrícula:</strong> <span class="detail-desc">${vehicle.matricula}</span>
      </div>
      <div class="detail-row">
        <strong>Marca y Modelo:</strong> <span class="detail-desc">${vehicle.marca} ${vehicle.modelo}</span>
      </div>
      <div class="detail-row">
        <strong>Tipo de Batería:</strong> <span class="detail-desc">${vehicle.tipo}</span>
      </div>
      <div class="detail-row">
        <strong>Estado:</strong> <span class="detail-desc">${vehicle.estado}</span>
      </div>
      <div class="detail-row">
        <strong>Conductor Actual:</strong> <span class="detail-desc">${driverLabel}</span>
      </div>
    `;

    this.confirmationService.confirm({
      title: 'Detalles del Vehículo',
      htmlContent: htmlContent,
      confirmText: 'Cerrar',
      type: 'info',
      cancelText: '' // Hide cancel button
    });
  }

  async editVehicle(vehicle: FleetVehicle) {
    const confirmed = await this.confirmationService.confirm({
      title: 'Editar Vehículo',
      message: `¿Deseas editar la información del vehículo con matrícula ${vehicle.matricula}?`,
      confirmText: 'Editar',
      type: 'primary'
    });

    if (confirmed) {
      this.isEditing = true;
      this.editingId = vehicle.id;
      this.newVehicle = {
        matricula: vehicle.matricula,
        marca: vehicle.marca,
        modelo: vehicle.modelo,
        tipo: vehicle.tipo
      };
      window.scrollTo({ top: 0, behavior: 'smooth' });
      this.formSuccess = null;
    }
  }

  async deleteVehicle(vehicle: FleetVehicle) {
    const confirmed = await this.confirmationService.confirm({
      message: `¿Estás seguro de eliminar el vehículo ${vehicle.matricula}?`,
      title: 'Eliminar Vehículo',
      confirmText: 'Eliminar',
      type: 'danger'
    });

    if (confirmed) {
      this.fleetService.deleteVehicle(vehicle.id);
    }
  }
}

