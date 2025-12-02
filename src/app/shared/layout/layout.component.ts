import { Component, OnInit, ViewEncapsulation, OnDestroy } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../core/services/theme.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css',
  encapsulation: ViewEncapsulation.None
})
export class LayoutComponent implements OnInit, OnDestroy {
  sidebarOpen = false;
  isAdmin = false; // Se sincroniza desde el almacenamiento cuando la vista inicia
  isDarkMode = false;
  private themeSubscription?: Subscription;

  constructor(
    private router: Router,
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    this.syncAdminStatus();
    this.isDarkMode = this.themeService.isDarkMode();
    this.themeSubscription = this.themeService.theme$.subscribe(theme => {
      this.isDarkMode = theme === 'dark';
    });
  }

  ngOnDestroy(): void {
    if (this.themeSubscription) {
      this.themeSubscription.unsubscribe();
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

  private syncAdminStatus() {
    try {
      const storage = typeof window !== 'undefined' ? window.sessionStorage : undefined;
      if (!storage) {
        this.isAdmin = false;
        return;
      }
      const storedRole = storage.getItem('userRole');
      const isLoggedIn = storage.getItem('isLoggedIn') === 'true';
      this.isAdmin = isLoggedIn && storedRole === 'admin';
    } catch {
      this.isAdmin = false;
    }
  }
}

