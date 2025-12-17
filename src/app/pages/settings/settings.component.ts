import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LayoutComponent } from '../../shared/layout/layout.component';
import { AuthService } from '../../core/services/auth.service';

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

  constructor(
    private router: Router,
    private authService: AuthService
  ) {
    this.checkLoginStatus();
  }

  checkLoginStatus() {
    this.authService.currentUser$.subscribe(user => {
      this.isLoggedIn = !!user;
    });
  }

  logout() {
    this.authService.logout();
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
    if (!this.currentPassword || !this.newPassword || !this.confirmPassword) {
      this.showMessage('Por favor completa todos los campos', 'error');
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.showMessage('Las contraseñas no coinciden', 'error');
      return;
    }

    if (this.newPassword.length < 4) {
      this.showMessage('La contraseña es muy corta', 'error');
      return;
    }

    this.loading = true;
    this.hideMessage();

    this.authService.changePassword(this.currentPassword, this.newPassword).subscribe(success => {
      this.loading = false;
      if (success) {
        this.showMessage('¡Contraseña cambiada exitosamente!', 'success');
        setTimeout(() => {
          this.closeChangePasswordModal();
        }, 1500);
      } else {
        this.showMessage('La contraseña actual es incorrecta', 'error');
      }
    });
  }

  showMessage(text: string, type: 'success' | 'error' | 'info') {
    this.message = text;
    this.messageType = type;
  }

  hideMessage() {
    this.message = '';
  }
}

