import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface AuditLog {
    id: string;
    timestamp: Date;
    action: 'CREAR' | 'ACTUALIZAR' | 'ELIMINAR';
    category: 'CONDUCTOR' | 'VEHICULO' | 'RUTA' | 'PARADA' | 'MAPA';
    details: string;
    user: string;
}

@Injectable({
    providedIn: 'root'
})
export class AuditService {
    private readonly STORAGE_KEY = 'audit_logs';
    private logsSubject = new BehaviorSubject<AuditLog[]>([]);
    readonly logs$ = this.logsSubject.asObservable();

    constructor() {
        this.loadLogs();
    }

    private loadLogs() {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                // Revive dates
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
            user: 'Admin' // Hardcoded for now per requirements
        };

        const updatedLogs = [newLog, ...currentLogs];
        this.logsSubject.next(updatedLogs);
        this.saveLogs(updatedLogs);
    }

    private saveLogs(logs: AuditLog[]) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(logs));
    }

    clearLogs() {
        this.logsSubject.next([]);
        localStorage.removeItem(this.STORAGE_KEY);
    }

    getLogs(): Observable<AuditLog[]> {
        return this.logs$;
    }
}
