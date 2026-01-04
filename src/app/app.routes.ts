import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { LoginComponent } from './pages/login/login.component';
import { ConductoresComponent } from './pages/conductores/conductores.component';
import { VehiculosComponent } from './pages/vehiculos/vehiculos.component';
import { RutasComponent } from './pages/rutas/rutas.component';
import { MonitoringComponent } from './pages/monitoring/monitoring.component';
import { ReportsComponent } from './pages/reports/reports.component';
import { DriverIssuesComponent } from './pages/driver-issues/driver-issues.component';
import { AdminSupportComponent } from './pages/admin-support/admin-support.component';
import { AdminSessionsComponent } from './pages/admin-sessions/admin-sessions.component';
import { SettingsComponent } from './pages/settings/settings.component';
import { AuthGuard } from './core/guards/auth.guard'; // Fixed Path

export const routes: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: 'home', component: HomeComponent },
  { path: 'login', component: LoginComponent },
  { path: 'dashboard', redirectTo: '/home', pathMatch: 'full' },

  // Admin Routes
  { path: 'conductores', component: ConductoresComponent, canActivate: [AuthGuard], data: { roles: ['admin'] } },
  { path: 'vehiculos', component: VehiculosComponent, canActivate: [AuthGuard], data: { roles: ['admin'] } },
  { path: 'rutas', component: RutasComponent, canActivate: [AuthGuard], data: { roles: ['admin'] } }, // "Planificación"
  { path: 'reports', component: ReportsComponent, canActivate: [AuthGuard], data: { roles: ['admin'] } },
  { path: 'admin-sessions', component: AdminSessionsComponent, canActivate: [AuthGuard], data: { roles: ['admin'] } },
  { path: 'admin-support', component: AdminSupportComponent, canActivate: [AuthGuard], data: { roles: ['admin'] } },

  // Shared / Driver Routes
  {
    path: 'monitoring',
    loadComponent: () => import('./pages/monitoring/monitoring.component').then(m => m.MonitoringComponent),
    canActivate: [AuthGuard],
    data: { roles: ['admin'] } // Solo admin
  },
  { path: 'driver-issues', component: DriverIssuesComponent, canActivate: [AuthGuard], data: { roles: ['driver'] } },
  { path: 'settings', component: SettingsComponent, canActivate: [AuthGuard], data: { roles: ['admin', 'driver'] } },

  {
    path: 'historial',
    loadComponent: () => import('./pages/history/history.component').then(m => m.HistoryComponent),
    canActivate: [AuthGuard],
    data: { roles: ['admin'] }
  },

  { path: '**', redirectTo: '/home' }
];
