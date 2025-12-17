import { Component, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { LayoutComponent } from '../../shared/layout/layout.component';
import { FleetService, Driver, FleetVehicle } from '../../core/services/fleet.service';
import { ConfirmationService } from '../../core/services/confirmation.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-conductores',
  standalone: true,
  imports: [CommonModule, FormsModule, LayoutComponent],
  templateUrl: './conductores.component.html',
  styleUrl: './conductores.component.css',
  encapsulation: ViewEncapsulation.None
})
export class ConductoresComponent implements OnInit, OnDestroy {
  drivers: Driver[] = [];
  vehicles: FleetVehicle[] = [];
  availableLicenseCategories = [
    { code: 'A-1', label: 'Ciclomotores y motos ligeras' },
    { code: 'A', label: 'Motocicletas' },
    { code: 'B', label: 'Autos ligeros' },
    { code: 'C-1', label: 'Camiones ligeros' },
    { code: 'C', label: 'Vehículos de carga pesados' },
    { code: 'D-1', label: 'Transporte urbano de pasajeros' },
    { code: 'D', label: 'Transporte interprovincial de pasajeros' },
    { code: 'E', label: 'Remolques y articulados' },
    { code: 'F', label: 'Vehículos especiales' },
    { code: 'F-E', label: 'Especiales con remolque' }
  ];

  newDriver: {
    ci: string;
    nombreCompleto: string;
    telefono: string;
    email: string;
    categorias: string[];
    direccion: string;
  } = {
      ci: '',
      nombreCompleto: '',
      telefono: '',
      email: '',
      categorias: [],
      direccion: ''
    };

  ageError: string | null = null;
  ageWarning: string | null = null;

  formError: string | null = null;
  formSuccess: string | null = null;

  private subscriptions = new Subscription();

  constructor(
    private fleetService: FleetService,
    private confirmationService: ConfirmationService
  ) { }

  ngOnInit(): void {
    this.subscriptions.add(
      this.fleetService.drivers$.subscribe(drivers => (this.drivers = drivers))
    );
    this.subscriptions.add(
      this.fleetService.vehicles$.subscribe(vehicles => (this.vehicles = vehicles))
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  isEditing = false;
  editingId: number | null = null;

  @ViewChild('driverForm') driverForm!: NgForm;

  async onSubmit() {
    // Limpiar mensajes previos
    this.formError = null;
    this.formSuccess = null;

    // Validaciones básicas de formulario (campos obligatorios y patrones)
    // Nota: El botón submit debería estar deshabilitado si el formulario es inválido,
    // pero mantenemos esta validación por seguridad.
    if (this.driverForm.invalid) {
      this.driverForm.control.markAllAsTouched();

      const missingFields: string[] = [];
      if (this.driverForm.controls['ci']?.errors) missingFields.push('CI');
      if (this.driverForm.controls['nombreCompleto']?.errors) missingFields.push('Nombre Completo');
      if (this.driverForm.controls['telefono']?.errors) missingFields.push('Teléfono');
      if (this.driverForm.controls['email']?.errors) missingFields.push('Email');
      if (this.driverForm.controls['direccion']?.errors) missingFields.push('Dirección');

      if (missingFields.length > 0) {
        this.formError = `Faltan campos obligatorios o inválidos: ${missingFields.join(', ')}.`;
      } else {
        // Fallback genérico por si hay otro error no mapeado
        this.formError = 'Por favor, revisa los campos en rojo.';
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!this.newDriver.categorias.length) {
      this.formError = 'Selecciona al menos una categoría de licencia para el conductor.';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Debe tener al menos D-1 para poder conducir el ecomóvil
    if (!this.newDriver.categorias.includes('D-1')) {
      this.formError = 'Para manejar el ecomóvil, el conductor debe tener al menos la categoría D-1 en su licencia.';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Validar edad desde el CI
    if (!this.validateAgeFromCI()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (this.isEditing && this.editingId) {
      await this.confirmUpdate();
    } else {
      this.createDriver();
    }
  }

  private async confirmUpdate() {
    console.log('Initiating confirmUpdate', { editingId: this.editingId, newDriver: this.newDriver });
    const confirmed = await this.confirmationService.confirm({
      title: 'Confirmar Edición',
      message: '¿Estás seguro de guardar los cambios para este conductor?',
      confirmText: 'Guardar Cambios',
      type: 'warning'
    });
    console.log('Confirmation result:', confirmed);

    if (confirmed && this.editingId) {
      console.log('Updating driver in service...');
      this.fleetService.updateDriver({
        id: this.editingId,
        ci: this.newDriver.ci,
        nombreCompleto: this.newDriver.nombreCompleto,
        telefono: this.newDriver.telefono,
        email: this.newDriver.email,
        categorias: [...this.newDriver.categorias],
        direccion: this.newDriver.direccion,
        vehiculoId: this.getDriverVehicleId(this.editingId)
      });
      console.log('Driver updated.');
      this.formSuccess = 'Conductor actualizado correctamente.';
      this.cancelEdit();
    }
  }

  private getDriverVehicleId(id: number): number | null {
    const driver = this.drivers.find(d => d.id === id);
    return driver ? driver.vehiculoId : null;
  }

  private createDriver() {
    this.fleetService.addDriver({
      ci: this.newDriver.ci,
      nombreCompleto: this.newDriver.nombreCompleto,
      telefono: this.newDriver.telefono,
      email: this.newDriver.email,
      categorias: [...this.newDriver.categorias],
      direccion: this.newDriver.direccion
    });
    this.formSuccess = 'Conductor registrado correctamente (solo vista).';
    this.resetForm();
  }

  cancelEdit() {
    this.isEditing = false;
    this.editingId = null;
    this.resetForm();
    this.formError = null;
    this.formSuccess = null;
  }

  validateAgeFromCI(): boolean {
    // Validar formato del CI: exactamente 11 dígitos numéricos
    const ciPattern = /^[0-9]{11}$/;
    if (!ciPattern.test(this.newDriver.ci)) {
      this.ageError = 'El CI debe tener exactamente 11 dígitos numéricos.';
      this.ageWarning = null;
      return false;
    }

    // Extraer fecha de nacimiento del CI: primeros 6 dígitos (YYMMDD)
    const dateStr = this.newDriver.ci.substring(0, 6);
    const year = parseInt(dateStr.substring(0, 2), 10);
    const month = parseInt(dateStr.substring(2, 4), 10);
    const day = parseInt(dateStr.substring(4, 6), 10);

    // Validar que los valores sean válidos
    if (isNaN(year) || isNaN(month) || isNaN(day) || month < 1 || month > 12 || day < 1 || day > 31) {
      this.ageError = 'La fecha de nacimiento extraída del CI no es válida.';
      this.ageWarning = null;
      return false;
    }

    // Convertir año de 2 dígitos a 4 dígitos (asumiendo años 00-99 como 2000-2099)
    // Si el año es mayor a 50, probablemente es del siglo pasado (1950-1999)
    const fullYear = year > 50 ? 1900 + year : 2000 + year;

    // Crear fecha de nacimiento
    const birthDate = new Date(fullYear, month - 1, day);

    // Validar que la fecha sea válida
    if (birthDate.getFullYear() !== fullYear || birthDate.getMonth() !== month - 1 || birthDate.getDate() !== day) {
      this.ageError = 'La fecha de nacimiento extraída del CI no es válida.';
      this.ageWarning = null;
      return false;
    }

    // Calcular edad
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    // Validar que sea mayor de edad
    if (age < 18) {
      this.ageError = `El conductor es menor de edad (${age} años). Debe cumplir 18 años para poder registrarse.`;
      this.ageWarning = null;
      return false;
    }

    // Advertencia si es mayor de 80 años, pero permitir el registro
    if (age > 80) {
      this.ageWarning = `El conductor tiene ${age} años. Verifique que la persona está apta para conducir antes de registrarlo.`;
    } else {
      this.ageWarning = null;
    }

    this.ageError = null;
    return true;
  }

  onCIChange() {
    // Limpiar error cuando el usuario modifica el CI
    this.ageError = null;
    this.ageWarning = null;
  }

  resetForm() {
    this.newDriver = {
      ci: '',
      nombreCompleto: '',
      telefono: '',
      email: '',
      categorias: [],
      direccion: ''
    };
    this.ageError = null;
    this.ageWarning = null;
  }

  toggleCategory(categoryCode: string, checked: boolean) {
    if (checked) {
      if (!this.newDriver.categorias.includes(categoryCode)) {
        this.newDriver.categorias = [...this.newDriver.categorias, categoryCode];
      }
    } else {
      this.newDriver.categorias = this.newDriver.categorias.filter(code => code !== categoryCode);
    }
  }

  async assignVehicle(driverId: number, vehicleValue: string) {
    const vehicleId = vehicleValue ? Number(vehicleValue) : null;
    const driver = this.drivers.find(d => d.id === driverId);

    if (!driver || driver.vehiculoId === vehicleId) {
      return;
    }

    const currentVehicle = driver.vehiculoId
      ? this.vehicles.find(v => v.id === driver.vehiculoId) ?? null
      : null;
    const nextVehicle = vehicleId ? this.vehicles.find(v => v.id === vehicleId) ?? null : null;

    if (!(await this.confirmVehicleAssignment(driver, currentVehicle, nextVehicle))) {
      // Si cancela, forzar actualización de la vista para revertir el select (hack simple)
      // En un escenario real, lo ideal es no usar ngModel bidireccional directo o resetearlo explícitamente.
      // Pero como el array 'drivers' no ha cambiado, Angular debería redibujar.
      // Forzamos un 'refresh' simulado:
      this.drivers = [...this.drivers];
      return;
    }

    this.fleetService.assignVehicleToDriver(driverId, vehicleId);
  }

  private async confirmVehicleAssignment(
    driver: Driver,
    currentVehicle: FleetVehicle | null,
    nextVehicle: FleetVehicle | null
  ): Promise<boolean> {
    const currentLabel = currentVehicle
      ? `${currentVehicle.marca} ${currentVehicle.modelo} (${currentVehicle.matricula})`
      : 'Sin vehículo asignado';
    const nextLabel = nextVehicle
      ? `${nextVehicle.marca} ${nextVehicle.modelo} (${nextVehicle.matricula})`
      : 'Sin vehículo';

    const message = [
      `¿Deseas cambiar el vehículo del conductor ${driver.nombreCompleto}?`,
      `Actual: ${currentLabel}`,
      `Nuevo: ${nextLabel}`,
      '',
      'Esta acción registrará la hora del cambio.'
    ].join('\n');

    return await this.confirmationService.confirm({
      message,
      title: 'Confirmar Asignación',
      confirmText: 'Asignar',
      type: 'warning'
    });
  }

  getVehicleLabel(driver: Driver): string {
    const vehicle = this.vehicles.find(v => v.id === driver.vehiculoId);
    return vehicle ? `${vehicle.matricula} (${vehicle.marca} ${vehicle.modelo})` : 'Sin asignar';
  }

  viewDriver(driver: Driver) {
    const vehicleLabel = this.getVehicleLabel(driver);
    const htmlContent = `
      <div class="detail-row">
        <strong>CI:</strong> <span class="detail-desc">${driver.ci}</span>
      </div>
      <div class="detail-row">
        <strong>Nombre Completo:</strong> <span class="detail-desc">${driver.nombreCompleto}</span>
      </div>
      <div class="detail-row">
        <strong>Teléfono:</strong> <span class="detail-desc">${driver.telefono}</span>
      </div>
      <div class="detail-row">
        <strong>Email:</strong> <span class="detail-desc">${driver.email}</span>
      </div>
      <div class="detail-row">
        <strong>Categorías:</strong> <span class="detail-desc">${driver.categorias.join(', ')}</span>
      </div>
      <div class="detail-row">
        <strong>Dirección:</strong> <span class="detail-desc">${driver.direccion || 'No registrada'}</span>
      </div>
      <div class="detail-row">
        <strong>Vehículo Asignado:</strong> <span class="detail-desc">${vehicleLabel}</span>
      </div>
    `;

    this.confirmationService.confirm({
      title: 'Detalles del Conductor',
      htmlContent: htmlContent,
      confirmText: 'Cerrar',
      type: 'info',
      cancelText: ''
    });
  }

  async editDriver(driver: Driver) {
    const confirmed = await this.confirmationService.confirm({
      title: 'Editar Conductor',
      message: `¿Deseas editar la información del conductor ${driver.nombreCompleto}?`,
      confirmText: 'Editar',
      type: 'primary'
    });

    if (confirmed) {
      this.isEditing = true;
      this.editingId = driver.id;
      this.newDriver = {
        ci: driver.ci,
        nombreCompleto: driver.nombreCompleto,
        telefono: driver.telefono,
        email: driver.email,
        categorias: [...driver.categorias],
        direccion: driver.direccion || ''
      };
      // Scroll al formulario
      window.scrollTo({ top: 0, behavior: 'smooth' });
      this.formSuccess = null;
      this.formError = null;
    }
  }

  async deleteDriver(driver: Driver) {
    const confirmed = await this.confirmationService.confirm({
      message: `¿Estás seguro de eliminar al conductor ${driver.nombreCompleto}?`,
      title: 'Eliminar Conductor',
      confirmText: 'Eliminar',
      type: 'danger'
    });

    if (confirmed) {
      this.fleetService.deleteDriver(driver.id);
      this.formSuccess = 'Conductor eliminado correctamente.';
    }
  }
}

