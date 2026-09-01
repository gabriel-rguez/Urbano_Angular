import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LayoutComponent } from '../../shared/layout/layout.component';
import { AuditService, AuditLog } from '../../core/services/audit.service';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmationService } from '../../core/services/confirmation.service';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

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

        if (confirmed) {
            this.auditService.clearLogs();
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
