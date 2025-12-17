import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LayoutComponent } from '../../shared/layout/layout.component';
import { ReportsService, Report } from '../../core/services/reports.service';
import { ConfirmationService } from '../../core/services/confirmation.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, LayoutComponent],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.css'
})
export class ReportsComponent implements OnInit {
  reports: Report[] = [];

  constructor(
    private reportsService: ReportsService,
    private confirmationService: ConfirmationService,
    private router: Router
  ) { }

  ngOnInit() {
    this.reportsService.reports$.subscribe(data => {
      this.reports = data;
    });
  }

  async updateStatus(report: Report, status: 'open' | 'in-progress' | 'closed') {
    if (status === 'closed') {
      const confirmed = await this.confirmationService.confirm({
        title: 'Cerrar Reporte',
        message: '¿Estás seguro de que deseas cerrar este reporte? Esto indicará que la incidencia ha sido resuelta.',
        confirmText: 'Sí, cerrar',
        cancelText: 'Cancelar',
        type: 'warning'
      });

      if (!confirmed) return;
    } else if (status === 'open' && report.status === 'closed') {
      // Reopening logic (optional confirmation)
      const confirmed = await this.confirmationService.confirm({
        title: 'Reabrir Reporte',
        message: '¿Deseas reabrir este reporte?',
        confirmText: 'Reabrir',
        type: 'info'
      });
      if (!confirmed) return;
    }

    this.reportsService.updateStatus(report.id, status);
  }

  async viewReport(report: Report) {
    await this.confirmationService.confirm({
      title: `Detalle del Reporte: ${report.id}`,
      htmlContent: `
        <div class="detail-row">
            <strong>Título:</strong> <span>${report.title || 'Sin título'}</span>
        </div>
        <div class="detail-row">
            <strong>Conductor:</strong> <span>${report.driverName}</span>
        </div>
        <div class="detail-row">
            <strong>Fecha:</strong> <span>${new Date(report.date).toLocaleString()}</span>
        </div>
        <div class="detail-row">
            <strong>Estado:</strong> <span>${this.getStatusLabel(report.status)}</span>
        </div>
        
        <div style="margin-top: 15px;">
            <strong>Descripción:</strong>
            <div class="detail-desc">
                ${report.description}
            </div>
        </div>
      `,
      confirmText: 'Cerrar',
      type: 'info',
    });
  }

  navigateToChat(report: Report) {
    if (report.sourceConversationId) {
      this.router.navigate(['/admin-support'], {
        queryParams: { conversationId: report.sourceConversationId }
      });
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'open': return 'status-open';
      case 'in-progress': return 'status-progress';
      case 'closed': return 'status-closed';
      default: return '';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'open': return 'Abierto';
      case 'in-progress': return 'En Proceso';
      case 'closed': return 'Cerrado';
      default: return status;
    }
  }
}
