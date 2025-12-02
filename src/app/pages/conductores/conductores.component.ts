import { Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { LayoutComponent } from '../../shared/layout/layout.component';
import { FleetService, Driver, FleetVehicle } from '../../core/services/fleet.service';
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

  constructor(private fleetService: FleetService) {}

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

  onSubmit(form: NgForm) {
    // Limpiar mensajes previos
    this.formError = null;
    this.formSuccess = null;

    // Validaciones básicas de formulario (campos obligatorios y patrones)
    if (form.invalid) {
      form.control.markAllAsTouched();
      this.formError = 'Por favor, completa correctamente todos los campos obligatorios antes de registrar el conductor.';
      return;
    }

    if (!this.newDriver.categorias.length) {
      this.formError = 'Selecciona al menos una categoría de licencia para el conductor.';
      return;
    }

    // Debe tener al menos D-1 para poder conducir el ecomóvil
    if (!this.newDriver.categorias.includes('D-1')) {
      this.formError = 'Para manejar el ecomóvil, el conductor debe tener al menos la categoría D-1 en su licencia.';
      return;
    }

    // Validar edad desde el CI
    if (!this.validateAgeFromCI()) {
      return;
    }

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

  assignVehicle(driverId: number, vehicleValue: string) {
    const vehicleId = vehicleValue ? Number(vehicleValue) : null;
    const driver = this.drivers.find(d => d.id === driverId);

    if (!driver || driver.vehiculoId === vehicleId) {
      return;
    }

    const currentVehicle = driver.vehiculoId
      ? this.vehicles.find(v => v.id === driver.vehiculoId) ?? null
      : null;
    const nextVehicle = vehicleId ? this.vehicles.find(v => v.id === vehicleId) ?? null : null;

    if (!this.confirmVehicleAssignment(driver, currentVehicle, nextVehicle)) {
      return;
    }

    this.fleetService.assignVehicleToDriver(driverId, vehicleId);
  }

  private confirmVehicleAssignment(
    driver: Driver,
    currentVehicle: FleetVehicle | null,
    nextVehicle: FleetVehicle | null
  ): boolean {
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

    return confirm(message);
  }

  getVehicleLabel(driver: Driver): string {
    const vehicle = this.vehicles.find(v => v.id === driver.vehiculoId);
    return vehicle ? `${vehicle.matricula} (${vehicle.marca} ${vehicle.modelo})` : 'Sin asignar';
  }

  editDriver(driver: Driver) {
    console.log('Editar conductor:', driver);
  }

  deleteDriver(driver: Driver) {
    if (confirm('¿Estás seguro de eliminar este conductor?')) {
      console.log('Eliminar conductor:', driver);
    }
  }
}

