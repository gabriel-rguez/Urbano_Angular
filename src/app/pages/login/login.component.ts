import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit {
  username = '';
  password = '';
  loading = false;
  message = '';
  messageType: 'success' | 'error' | 'info' = 'info';

  @ViewChild('passwordInput') passwordInput!: ElementRef<HTMLInputElement>;
  @ViewChild('usernameInput') usernameInput!: ElementRef<HTMLInputElement>;

  constructor(
    private router: Router,
    private authService: AuthService
  ) { }

  ngOnInit() {
    // Asegurar que los campos estén vacíos al inicializar
    this.username = '';
    this.password = '';
  }

  ngAfterViewInit() {
    // Limpiar los campos después de que la vista se inicialice
    setTimeout(() => {
      if (this.passwordInput?.nativeElement) {
        this.passwordInput.nativeElement.value = '';
        this.password = '';
      }
      if (this.usernameInput?.nativeElement) {
        this.usernameInput.nativeElement.value = '';
        this.username = '';
      }
    }, 0);
  }

  onSubmit() {
    if (!this.username || !this.password) {
      this.showMessage('Por favor completa todos los campos', 'error');
      return;
    }

    this.loading = true;
    this.hideMessage();

    this.authService.login(this.username, this.password).subscribe({
      next: (success) => {
        this.loading = false;
        if (success) {
          const user = this.authService.getCurrentUser();
          this.showMessage('¡Login exitoso! Redirigiendo...', 'success');

          setTimeout(() => {
            this.router.navigate(['/home']);
          }, 1000);
        } else {
          this.showMessage('Usuario o contraseña incorrectos', 'error');
        }
      },
      error: () => {
        this.loading = false;
        this.showMessage('Error al intentar iniciar sesión', 'error');
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

