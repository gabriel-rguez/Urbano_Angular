import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface AuditLog {
    id: string;
    timestamp: Date;
    action: 'CREAR' | 'ACTUALIZAR' | 'ELIMINAR';
    category: 'CONDUCTOR' | 'VEHICULO' | 'RUTA' | 'PARADA' | 'MAPA';
    details: string;
    user: string;
}

interface AuditLogDto {
    id: string;
    timestamp: string;
    accion: string;
    categoria: string;
    detalles: string;
    usuario: string;
}

@Injectable({
    providedIn: 'root'
})
export class AuditService {
    private readonly STORAGE_KEY = 'audit_logs';
    private logsSubject = new BehaviorSubject<AuditLog[]>([]);
    readonly logs$ = this.logsSubject.asObservable();

    constructor(
        private http: HttpClient,
        private authService: AuthService
    ) {
        this.loadLogs();
    }

    private loadLogs() {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                const logs = parsed.map((log: any) => ({
                    ...log,
                    timestamp: new Date(log.timestamp)
                }));
                this.logsSubject.next(logs);
            } catch (e) {
                console.error('Error loading audit logs', e);
                this.logsSubject.next([]);
            }
        }

        // Sincronizar con el historial persistido en la base de datos.
        // Solo tiene sentido para usuarios autenticados (admin), no para la vista pública.
        if (!this.authService.getCurrentUser()) {
            return;
        }
        this.http.get<AuditLogDto[]>(`${environment.apiUrl}/Auditoria/v1/listar`).pipe(
            catchError(() => of([] as AuditLogDto[]))
        ).subscribe({
            next: (logs) => {
                const dbLogs = logs.map((l) => this.fromDto(l));
                this.logsSubject.next(dbLogs);
                this.saveLogs(dbLogs);
            },
            error: () => { /* se mantiene lo de localStorage */ }
        });
    }

    logAction(
        action: AuditLog['action'],
        category: AuditLog['category'],
        details: string
    ) {
        const currentLogs = this.logsSubject.getValue();
        const newLog: AuditLog = {
            id: crypto.randomUUID(),
            timestamp: new Date(),
            action,
            category,
            details,
            user: this.currentUserLabel()
        };

        const updatedLogs = [newLog, ...currentLogs];
        this.logsSubject.next(updatedLogs);
        this.saveLogs(updatedLogs);

        // Persistir en la base de datos.
        this.http.post(`${environment.apiUrl}/Auditoria/v1/registrar`, {
            accion: action,
            categoria: category,
            detalles: details,
            usuario: newLog.user
        }).pipe(
            catchError(() => of(null))
        ).subscribe();
    }

    private currentUserLabel(): string {
        const user = this.authService.getCurrentUser();
        const email = (user as any)?.email || (user as any)?.username;
        return email || 'Admin';
    }

    private fromDto(dto: AuditLogDto): AuditLog {
        return {
            id: dto.id ?? crypto.randomUUID(),
            timestamp: new Date(dto.timestamp),
            action: dto.accion as AuditLog['action'],
            category: dto.categoria as AuditLog['category'],
            details: dto.detalles,
            user: dto.usuario || 'Admin'
        };
    }

    private saveLogs(logs: AuditLog[]) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(logs));
    }

    clearLogs() {
        this.logsSubject.next([]);
        localStorage.removeItem(this.STORAGE_KEY);
        // Borrar también el historial persistido en la base de datos (si hay sesión).
        if (this.authService.getCurrentUser()) {
            this.http.delete(`${environment.apiUrl}/Auditoria/v1/limpiar`).pipe(
                catchError(() => of(null))
            ).subscribe();
        }
    }

    getLogs(): Observable<AuditLog[]> {
        return this.logs$;
    }
}
