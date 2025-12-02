import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LayoutComponent } from '../../shared/layout/layout.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, LayoutComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css'
})
export class SettingsComponent {
  showChangePasswordModal = false;
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  loading = false;
  message = '';
  messageType: 'success' | 'error' | 'info' = 'info';
  isLoggedIn = false;

  constructor(private router: Router) {
    this.checkLoginStatus();
  }

  checkLoginStatus() {
    try {
      const storage = typeof window !== 'undefined' ? window.sessionStorage : undefined;
      if (storage) {
        this.isLoggedIn = storage.getItem('isLoggedIn') === 'true';
      }
    } catch {
      this.isLoggedIn = false;
    }
  }

  logout() {
    // Limpiar sessionStorage
    sessionStorage.removeItem('userRole');
    sessionStorage.removeItem('isLoggedIn');
    this.isLoggedIn = false;
    // Redirigir al login
    this.router.navigate(['/login']);
  }

  openChangePasswordModal() {
    this.showChangePasswordModal = true;
    this.resetPasswordForm();
  }

  closeChangePasswordModal() {
    this.showChangePasswordModal = false;
    this.resetPasswordForm();
  }

  resetPasswordForm() {
    this.currentPassword = '';
    this.newPassword = '';
    this.confirmPassword = '';
    this.message = '';
  }

  onChangePassword() {
    // Validaciones
    if (!this.currentPassword || !this.newPassword || !this.confirmPassword) {
      this.showMessage('Por favor completa todos los campos', 'error');
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.showMessage('Las contraseñas no coinciden', 'error');
      return;
    }

    if (this.newPassword.length < 6) {
      this.showMessage('La nueva contraseña debe tener al menos 6 caracteres', 'error');
      return;
    }

    this.loading = true;
    this.hideMessage();

    // Simulación de cambio de contraseña (sin API)
    setTimeout(() => {
      this.loading = false;
      this.showMessage('¡Contraseña cambiada exitosamente!', 'success');
      setTimeout(() => {
        this.closeChangePasswordModal();
      }, 1500);
    }, 1500);
  }

  showMessage(text: string, type: 'success' | 'error' | 'info') {
    this.message = text;
    this.messageType = type;
  }

  hideMessage() {
    this.message = '';
  }
}

