import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LayoutComponent } from '../../shared/layout/layout.component';
import { FleetService, FleetVehicle } from '../../core/services/fleet.service';
import { AuthService } from '../../core/services/auth.service';
import {
  DriverVehicleStatus,
  VEHICLE_STATUS_OPTIONS,
  normalizeVehicleStatus,
  vehicleStatusLabel
} from '../../core/utils/vehicle-status';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-driver-status',
  standalone: true,
  imports: [CommonModule, LayoutComponent],
  templateUrl: './driver-status.component.html',
  styleUrl: './driver-status.component.css'
})
export class DriverStatusComponent implements OnInit, OnDestroy {
  readonly options = VEHICLE_STATUS_OPTIONS;
  vehicle: FleetVehicle | null = null;
  selected: DriverVehicleStatus = 'TRABAJANDO';
  saving = false;
  message = '';
  error = '';
  private subscriptions = new Subscription();

  constructor(
    private fleetService: FleetService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Forzar recarga de vehículos y conductores al iniciar
    this.fleetService.refreshDataFromBackend().subscribe();
    this.subscriptions.add(
      this.fleetService.vehicles$.subscribe(() => this.syncAssignedVehicle())
    );
    this.subscriptions.add(
      this.fleetService.drivers$.subscribe(() => this.syncAssignedVehicle())
    );
    this.subscriptions.add(
      this.authService.currentUser$.subscribe(() => this.syncAssignedVehicle())
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  get currentLabel(): string {
    return vehicleStatusLabel(this.selected);
  }

  get selectedColor(): string {
    return this.options.find(option => option.value === this.selected)?.color || '#22c55e';
  }

  selectStatus(status: DriverVehicleStatus) {
    if (this.saving || this.selected === status) {
      return;
    }
    if (!this.vehicle) {
      this.error = 'No tienes un ecomóvil asignado para cambiar el estado.';
      return;
    }

    this.saving = true;
    this.error = '';
    this.message = '';
    this.fleetService.updateDriverVehicleStatus(status).subscribe({
      next: (updated) => {
        this.vehicle = updated;
        this.selected = normalizeVehicleStatus(updated.estado);
        this.message = `Estado actualizado: ${vehicleStatusLabel(this.selected)}.`;
        this.saving = false;
      },
      error: (err) => {
        this.error = err?.message || 'No se pudo actualizar el estado.';
        this.saving = false;
      }
    });
  }

  private syncAssignedVehicle() {
    const current = this.fleetService.findAssignedVehicle(this.authService.getCurrentUser());
    this.vehicle = current;
    if (current) {
      this.selected = normalizeVehicleStatus(current.estado);
    }
  }
}
