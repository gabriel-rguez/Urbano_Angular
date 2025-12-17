
import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, ConfirmationOptions } from '../../../core/services/confirmation.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="confirmation-overlay" *ngIf="isVisible" (click)="onCancel()">
      <div class="confirmation-dialog" (click)="$event.stopPropagation()">
        <div class="dialog-header">
          <h3>
            <i class="fas" [ngClass]="getIcon()"></i>
            {{ options.title || 'Confirmación' }}
          </h3>
          <button class="close-btn" (click)="onCancel()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <div class="dialog-body">
          <p *ngIf="options.message && !options.htmlContent">{{ options.message }}</p>
          <div *ngIf="options.htmlContent" [innerHTML]="options.htmlContent" class="html-content"></div>
          
          <div *ngIf="options.inputs" class="dialog-inputs">
            <div *ngFor="let input of options.inputs" class="form-group">
              <label [for]="input.name">{{ input.label }}</label>
              <input *ngIf="!input.type || input.type === 'text'"
                     type="text" 
                     [id]="input.name" 
                     [(ngModel)]="inputValues[input.name]"
                     [placeholder]="input.placeholder || ''"
                     [required]="input.required || false"
                     class="form-control">
              <textarea *ngIf="input.type === 'textarea'"
                     [id]="input.name" 
                     [(ngModel)]="inputValues[input.name]"
                     [placeholder]="input.placeholder || ''"
                     [required]="input.required || false"
                     class="form-control"
                     rows="3"></textarea>
            </div>
          </div>
        </div>
        
        <div class="dialog-footer">
          <button class="btn-cancel" (click)="onCancel()">
            {{ options.cancelText || 'Cancelar' }}
          </button>
          <button class="btn-confirm" 
                  [class]="options.type || 'danger'" 
                  (click)="onConfirm()"
                  [disabled]="options.inputs && !areInputsValid()">
            {{ options.confirmText || 'Confirmar' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .confirmation-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.6);
      z-index: 9999;
      display: flex;
      justify-content: center;
      align-items: center;
      animation: fadeIn 0.2s ease-out;
      backdrop-filter: blur(2px);
    }

    .confirmation-dialog {
      background: var(--card-background);
      width: 90%;
      max-width: 450px;
      border-radius: 12px;
      box-shadow: 0 15px 40px rgba(0, 0, 0, 0.4);
      border: 1px solid var(--card-border);
      overflow: hidden;
      animation: scaleIn 0.2s ease-out;
    }

    .dialog-header {
      padding: 20px;
      border-bottom: 1px solid var(--card-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--surface-muted, rgba(0,0,0,0.02));
    }

    .dialog-header h3 {
      margin: 0;
      color: var(--text-color);
      font-size: 1.25rem;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .dialog-header h3 i {
      color: var(--primary-color);
    }

    .close-btn {
      background: none;
      border: none;
      color: var(--muted-text);
      cursor: pointer;
      font-size: 1.2rem;
      padding: 5px;
      transition: color 0.2s;
    }

    .close-btn:hover {
      color: var(--text-color);
    }

    .dialog-body {
      padding: 25px 20px;
      color: var(--text-color);
      font-size: 1rem;
      line-height: 1.5;
    }

    .dialog-footer {
      padding: 15px 20px;
      border-top: 1px solid var(--card-border);
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }

    .html-content {
      line-height: 1.6;
    }
    
    .html-content strong {
      color: var(--primary-color);
      font-weight: 600;
      display: inline-block;
      width: 100px;
    }

    .html-content p {
      margin-bottom: 8px;
    }

    .html-content .detail-row {
      display: flex;
      margin-bottom: 8px;
    }

    .html-content .detail-desc {
      background: var(--surface-muted);
      padding: 10px;
      border-radius: 6px;
      margin-top: 5px;
      border: 1px solid var(--card-border);
    }

    /* Botones reutilizando estilos base pero adaptados */
    .btn-cancel,
    .btn-confirm {
      padding: 10px 20px;
      border-radius: 8px;
      font-weight: 600;
      border: 1px solid transparent;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 0.95rem;
    }

    .btn-cancel {
      background: var(--surface-muted, #f1f5f9);
      color: var(--text-color);
      border-color: var(--card-border);
    }

    .btn-cancel:hover {
      background: var(--card-border);
    }

    /* Estilo peligro (Rojo/Naranja) - Predeterminado para borrados */
    .btn-confirm.danger {
      background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
      color: white;
      box-shadow: 0 4px 6px rgba(220, 53, 69, 0.2);
    }
    
    .btn-confirm.danger:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 10px rgba(220, 53, 69, 0.3);
    }

    /* Estilo advertencia (Amarillo/Naranja) */
    .btn-confirm.warning {
      background: linear-gradient(135deg, #facc15 0%, #f97316 80%);
      color: #0f172a;
    }

    /* Estilo info (Azul) */
    .btn-confirm.info {
      background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
      color: white;
    }

    /* Estilo primary (Violeta/Azul) - Para Edición/Creación */
    .btn-confirm.primary {
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
      color: white;
      box-shadow: 0 4px 6px rgba(99, 102, 241, 0.2);
    }

    .btn-confirm:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none !important;
        box-shadow: none !important;
    }

    .dialog-inputs {
        display: flex;
        flex-direction: column;
        gap: 15px;
        margin-top: 15px;
    }

    .form-group {
        display: flex;
        flex-direction: column;
        gap: 5px;
        text-align: left;
    }

    .form-group label {
        font-size: 0.9rem;
        font-weight: 500;
        color: var(--text-color);
        opacity: 0.9;
    }

    .form-control {
        padding: 10px;
        border-radius: 6px;
        border: 1px solid var(--card-border);
        background: var(--surface-muted, #f8fafc);
        color: var(--text-color);
        font-size: 1rem;
        width: 100%;
        box-sizing: border-box;
    }

    .form-control:focus {
        outline: none;
        border-color: var(--primary-color, #6366f1);
        box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
    }

    :host-context(.dark-theme) .form-control {
        background: #2d2d2d;
        border-color: #444;
    }

    /* Modo Oscuro - Ajustes específicos */
    :host-context(.dark-theme) .confirmation-dialog {
      background: #1e1e1e;
      border-color: #333;
    }

    :host-context(.dark-theme) .btn-confirm.danger {
      background: linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%);
      color: #fecaca;
      border: 1px solid #ef4444;
    }

    :host-context(.dark-theme) .btn-confirm.warning {
      background: linear-gradient(135deg, #422006 0%, #713f12 100%);
      color: #fef08a;
      border: 1px solid #eab308;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes scaleIn {
      from { transform: scale(0.95); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
  `]
})
export class ConfirmDialogComponent implements OnInit, OnDestroy {
  isVisible = false;
  options: ConfirmationOptions = { message: '' };
  private subscription?: Subscription;

  constructor(private confirmationService: ConfirmationService) { }

  ngOnInit() {
    this.subscription = this.confirmationService.confirmState$.subscribe(options => {
      this.options = options;
      this.isVisible = true;
      // Initialize inputs if present
      if (this.options.inputs) {
        this.inputValues = {};
        this.options.inputs.forEach(input => {
          this.inputValues[input.name] = input.value || '';
        });
      } else {
        this.inputValues = {};
      }
    });
  }

  inputValues: Record<string, string> = {};

  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }

  onConfirm() {
    // Validate required inputs
    if (this.options.inputs) {
      const missing = this.options.inputs.find(i => i.required && !this.inputValues[i.name]?.trim());
      if (missing) {
        // Shake or show error (for now just return)
        return;
      }
      this.isVisible = false;
      this.confirmationService.accept(this.inputValues);
    } else {
      this.isVisible = false;
      this.confirmationService.accept(true);
    }
  }

  onCancel() {
    this.isVisible = false;
    this.confirmationService.cancel();
  }

  areInputsValid(): boolean {
    if (!this.options.inputs) return true;
    return !this.options.inputs.some(i => i.required && !this.inputValues[i.name]?.trim());
  }

  getIcon(): string {
    switch (this.options.type) {
      case 'warning': return 'fa-exclamation-triangle';
      case 'info': return 'fa-info-circle';
      case 'primary': return 'fa-edit';
      default: return 'fa-exclamation-circle'; // danger
    }
  }
}
