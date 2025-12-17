import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Report {
    id: string;
    title: string;
    driverName: string;
    date: Date;
    description: string;
    status: 'open' | 'in-progress' | 'closed';
    sourceConversationId?: string;
}

@Injectable({
    providedIn: 'root'
})
export class ReportsService {
    private reportsSubject = new BehaviorSubject<Report[]>([]);
    public reports$ = this.reportsSubject.asObservable();

    constructor() {
        this.addMockReports();
    }

    private addMockReports() {
        const initialReports: Report[] = [
            {
                id: 'REP-001',
                title: 'Fallo en frenos',
                driverName: 'Juan Pérez',
                date: new Date(Date.now() - 86400000 * 2), // Hace 2 días
                description: 'Fallo recurrente en frenos del vehículo 54.',
                status: 'closed'
            },
            {
                id: 'REP-002',
                title: 'Problema GPS',
                driverName: 'Carlos Ruiz',
                date: new Date(Date.now() - 3600000 * 4), // Hace 4 horas
                description: 'GPS sin señal en zona montañosa.',
                status: 'open'
            }
        ];
        this.reportsSubject.next(initialReports);
    }

    getReports(): Observable<Report[]> {
        return this.reports$;
    }

    createReport(reportData: Omit<Report, 'id' | 'date' | 'status'>): void {
        const newReport: Report = {
            id: `REP-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
            date: new Date(),
            status: 'open',
            ...reportData
        };
        const currentReports = this.reportsSubject.value;
        this.reportsSubject.next([newReport, ...currentReports]);
    }

    updateStatus(id: string, status: 'open' | 'in-progress' | 'closed'): void {
        const currentReports = this.reportsSubject.value;
        const updatedReports = currentReports.map(report =>
            report.id === id ? { ...report, status } : report
        );
        this.reportsSubject.next(updatedReports);
    }
}
