import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LayoutComponent } from '../../shared/layout/layout.component';
import { AuditService, AuditLog } from '../../core/services/audit.service';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmationService } from '../../core/services/confirmation.service';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { firstValueFrom, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

@Component({
    selector: 'app-history',
    standalone: true,
    imports: [CommonModule, LayoutComponent, FormsModule],
    templateUrl: './history.component.html',
    styleUrl: './history.component.css'
})
export class HistoryComponent implements OnInit {
    logs: AuditLog[] = [];
    filteredLogs: AuditLog[] = [];

    categoryFilter: string = '';
    actionFilter: string = '';

    constructor(
        private auditService: AuditService,
        private authService: AuthService,
        private confirmationService: ConfirmationService,
        private router: Router
    ) { }

    ngOnInit() {
        // Protección de ruta manual
        const user = this.authService.getCurrentUser();
        if (!user || user.role !== 'admin') {
            this.router.navigate(['/home']);
            return;
        }
        // Forzar recarga de logs al iniciar
        this.auditService.getLogs().subscribe();
        this.auditService.logs$.subscribe(logs => {
            this.logs = logs;
            this.applyFilters();
        });
    }

    applyFilters() {
        this.filteredLogs = this.logs.filter(log => {
            const matchCategory = this.categoryFilter ? log.category === this.categoryFilter : true;
            const matchAction = this.actionFilter ? log.action === this.actionFilter : true;
            return matchCategory && matchAction;
        });
    }

    async clearHistory() {
        const confirmed = await this.confirmationService.confirm({
            title: 'Limpiar Historial',
            message: '¿Estás seguro de que deseas borrar todo el historial? Esta acción no se puede deshacer.',
            confirmText: 'Sí, borrar todo',
            type: 'danger'
        });

        if (!confirmed) {
            return;
        }

        // Verificación de seguridad: confirmar con la contraseña del administrador.
        const user = this.authService.getCurrentUser();
        const email = (user as any)?.email || (user as any)?.username || '';

        const result = await this.confirmationService.prompt({
            title: 'Verificación de seguridad',
            message: 'Para borrar el historial, confirma tu contraseña de administrador.',
            confirmText: 'Borrar historial',
            cancelText: 'Cancelar',
            type: 'danger',
            inputs: [
                { name: 'password', label: 'Contraseña', type: 'password', placeholder: 'Ingresa tu contraseña', required: true }
            ]
        });

        if (!result || !result['password']) {
            return;
        }

        const passwordValid = await firstValueFrom(
            this.authService.login(email, result['password']).pipe(
                map(() => true),
                catchError(() => of(false))
            )
        );

        if (passwordValid) {
            this.auditService.clearLogs();
            await this.confirmationService.confirm({
                title: 'Historial borrado',
                message: 'El historial de auditoría fue eliminado correctamente.',
                confirmText: 'Aceptar',
                type: 'info'
            });
        } else {
            await this.confirmationService.confirm({
                title: 'Contraseña incorrecta',
                message: 'La contraseña ingresada no es válida. El historial no fue borrado.',
                confirmText: 'Aceptar',
                type: 'warning'
            });
        }
    }

    getBadgeClass(action: string): string {
        switch (action) {
            case 'CREAR': return 'badge-create';
            case 'ACTUALIZAR': return 'badge-update';
            case 'ELIMINAR': return 'badge-delete';
            default: return 'badge-default';
        }
    }

    getCategoryIcon(category: string): string {
        switch (category) {
            case 'CONDUCTOR': return 'fas fa-id-card';
            case 'VEHICULO': return 'fas fa-car';
            case 'RUTA': return 'fas fa-route';
            case 'PARADA': return 'fas fa-map-marker-alt';
            case 'MAPA': return 'fas fa-map';
            default: return 'fas fa-info-circle';
        }
    }
}
