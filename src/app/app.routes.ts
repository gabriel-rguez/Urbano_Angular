import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { LoginComponent } from './pages/login/login.component';
import { ConductoresComponent } from './pages/conductores/conductores.component';
import { VehiculosComponent } from './pages/vehiculos/vehiculos.component';
import { RutasComponent } from './pages/rutas/rutas.component';
import { MonitoringComponent } from './pages/monitoring/monitoring.component';
import { ReportsComponent } from './pages/reports/reports.component';
import { SettingsComponent } from './pages/settings/settings.component';
import { DriverIssuesComponent } from './pages/driver-issues/driver-issues.component';
import { AdminSupportComponent } from './pages/admin-support/admin-support.component';
import { AdminSessionsComponent } from './pages/admin-sessions/admin-sessions.component';

export const routes: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: 'home', component: HomeComponent },
  { path: 'login', component: LoginComponent },
  { path: 'dashboard', redirectTo: '/home', pathMatch: 'full' },
  { path: 'conductores', component: ConductoresComponent },
  { path: 'vehiculos', component: VehiculosComponent },
  { path: 'rutas', component: RutasComponent },
  { path: 'monitoring', component: MonitoringComponent },
  { path: 'reports', component: ReportsComponent },
  { path: 'settings', component: SettingsComponent },

  // Nuevas rutas
  { path: 'driver-issues', component: DriverIssuesComponent },
  { path: 'admin-support', component: AdminSupportComponent },
  { path: 'admin-sessions', component: AdminSessionsComponent },

  { path: '**', redirectTo: '/home' }
];
