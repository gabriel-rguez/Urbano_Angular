import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

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

  constructor(private router: Router) {}

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

    // Simulación de login (solo vista, sin API)
    setTimeout(() => {
      this.loading = false;
      sessionStorage.setItem('userRole', 'admin');
      sessionStorage.setItem('isLoggedIn', 'true');
      this.showMessage('¡Login exitoso! Redirigiendo...', 'success');
      // Limpiar los campos después del login
      this.username = '';
      this.password = '';
      setTimeout(() => {
        this.router.navigate(['/dashboard']);
      }, 1000);
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

