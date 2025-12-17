import { Component, OnInit, ViewEncapsulation, OnDestroy } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../core/services/theme.service';
import { AuthService } from '../../core/services/auth.service';
import { Subscription } from 'rxjs';
import { ConfirmDialogComponent } from '../components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, ConfirmDialogComponent],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css',
  encapsulation: ViewEncapsulation.None
})
export class LayoutComponent implements OnInit, OnDestroy {
  sidebarOpen = false;
  isAdmin = false;
  isDriver = false;
  isDarkMode = false;
  private themeSubscription?: Subscription;
  private userSubscription?: Subscription;

  constructor(
    private router: Router,
    private themeService: ThemeService,
    private authService: AuthService
  ) { }

  ngOnInit(): void {
    // Suscribirse al estado del usuario
    this.userSubscription = this.authService.currentUser$.subscribe(user => {
      this.isAdmin = user?.role === 'admin';
      this.isDriver = user?.role === 'driver';
    });

    this.isDarkMode = this.themeService.isDarkMode();
    this.themeSubscription = this.themeService.theme$.subscribe(theme => {
      this.isDarkMode = theme === 'dark';
    });
  }

  ngOnDestroy(): void {
    if (this.themeSubscription) {
      this.themeSubscription.unsubscribe();
    }
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
  }

  isActive(route: string): boolean {
    return this.router.url.includes(route);
  }

  getCurrentTime(): string {
    return new Date().toLocaleTimeString();
  }
}

