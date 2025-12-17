import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService, Session } from '../../core/services/auth.service';
import { LayoutComponent } from '../../shared/layout/layout.component';
import { ConfirmationService } from '../../core/services/confirmation.service';

@Component({
    selector: 'app-admin-sessions',
    standalone: true,
    imports: [CommonModule, LayoutComponent],
    templateUrl: './admin-sessions.component.html',
    styleUrl: './admin-sessions.component.css'
})
export class AdminSessionsComponent implements OnInit {
    sessions: Session[] = [];
    users: any[] = []; // Lista de usuarios registrados

    constructor(
        private authService: AuthService,
        private confirmationService: ConfirmationService
    ) { }

    ngOnInit() {
        this.refreshData();
    }

    refreshData() {
        this.sessions = this.authService.getSessions();
        this.users = this.authService.getUsers();
    }

    refreshSessions() {
        this.refreshData();
    }

    // Session Actions
    async closeSession(sessionId: string) {
        const confirmed = await this.confirmationService.confirm({
            title: 'Cerrar Sesión',
            message: '¿Seguro que deseas cerrar esta sesión forzosamente?',
            confirmText: 'Cerrar Sesión',
            type: 'warning'
        });

        if (confirmed) {
            this.authService.closeSession(sessionId);
            this.refreshData();
        }
    }

    // User Actions
    async deleteUser(username: string) {
        if (username === 'admin') {
            await this.confirmationService.confirm({
                title: 'Acción no permitida',
                message: 'No puedes eliminar al administrador principal.',
                confirmText: 'Entendido',
                type: 'info'
            });
            return;
        }

        const confirmed = await this.confirmationService.confirm({
            title: 'Eliminar Usuario',
            message: `¿Estás seguro de eliminar al usuario ${username}? Esta acción no se puede deshacer.`,
            confirmText: 'Eliminar',
            type: 'danger'
        });

        if (confirmed) {
            this.authService.deleteUser(username);
            this.refreshData();
        }
    }

    async resetPassword(username: string) {
        const confirmed = await this.confirmationService.confirm({
            title: 'Restablecer Contraseña',
            message: `¿Deseas restablecer la contraseña de ${username} a "123456"?`,
            confirmText: 'Restablecer',
            type: 'warning'
        });

        if (confirmed) {
            const result = this.authService.resetPassword(username);
            if (result) {
                await this.confirmationService.confirm({
                    title: 'Éxito',
                    message: 'Contraseña restablecida correctamente.',
                    confirmText: 'OK',
                    type: 'info'
                });
            }
        }
    }
}
