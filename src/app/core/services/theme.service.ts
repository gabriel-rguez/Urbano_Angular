import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly THEME_KEY = 'app-theme';
  private readonly DARK_THEME = 'dark';
  private readonly LIGHT_THEME = 'light';
  
  private themeSubject = new BehaviorSubject<string>(this.getInitialTheme());
  public theme$: Observable<string> = this.themeSubject.asObservable();

  constructor() {
    this.applyTheme(this.getInitialTheme());
  }

  private getInitialTheme(): string {
    if (typeof window !== 'undefined' && window.localStorage) {
      const savedTheme = localStorage.getItem(this.THEME_KEY);
      if (savedTheme) {
        return savedTheme;
      }
    }
    return this.LIGHT_THEME;
  }

  getCurrentTheme(): string {
    return this.themeSubject.value;
  }

  isDarkMode(): boolean {
    return this.getCurrentTheme() === this.DARK_THEME;
  }

  toggleTheme(): void {
    const newTheme = this.isDarkMode() ? this.LIGHT_THEME : this.DARK_THEME;
    this.setTheme(newTheme);
  }

  setTheme(theme: string): void {
    if (theme === this.DARK_THEME || theme === this.LIGHT_THEME) {
      this.themeSubject.next(theme);
      this.applyTheme(theme);
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(this.THEME_KEY, theme);
      }
    }
  }

  private applyTheme(theme: string): void {
    if (typeof document !== 'undefined') {
      const htmlElement = document.documentElement;
      if (theme === this.DARK_THEME) {
        htmlElement.classList.add('dark-theme');
        htmlElement.classList.remove('light-theme');
      } else {
        htmlElement.classList.add('light-theme');
        htmlElement.classList.remove('dark-theme');
      }
    }
  }
}

