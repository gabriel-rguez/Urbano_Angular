import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, tap } from 'rxjs';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface User {
    username: string;
    role: 'admin' | 'driver';
    name: string;
    id?: string;
    email?: string;
}

export interface TokenResponse {
    access_token?: string;
    jwtToken?: string;
    refresh_token?: string;
    refreshToken?: string;
    expires_in?: number;
    refresh_expires_in?: number;
}

export interface Session {
    id: string;
    username: string;
    role: 'admin' | 'driver';
    loginTime: Date;
    active: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private currentUserSubject = new BehaviorSubject<User | null>(null);
    public currentUser$ = this.currentUserSubject.asObservable();
    
    private readonly AUTH_URL = environment.authUrl;

    constructor(
        private router: Router,
        private http: HttpClient
    ) {
        this.loadSession();
    }

    private loadSession() {
        const savedUser = sessionStorage.getItem('currentUser');
        if (savedUser) {
            this.currentUserSubject.next(JSON.parse(savedUser));
        }
    }

    private decodeToken(token: string): any {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(c => 
                '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
            ).join(''));
            return JSON.parse(jsonPayload);
        } catch {
            return null;
        }
    }

    login(username: string, password: string): Observable<TokenResponse> {
        return this.http.post<TokenResponse>(`${this.AUTH_URL}/login`, { email: username, username, password }).pipe(
            tap((response: any) => {
                const token = response.access_token || response.jwtToken;
                const refreshToken = response.refresh_token || response.refreshToken;
                const decoded = this.decodeToken(token);
                let role: 'admin' | 'driver' = 'admin';
                if (decoded) {
                    const realmRoles = decoded.realm_access?.roles || [];
                    const resourceRoles = [
                        ...(decoded.resource_access?.['ms-spring']?.roles || []),
                        ...(decoded.resource_access?.['account']?.roles || [])
                    ];
                    const allRoles = [...realmRoles, ...resourceRoles].map((r: string) => r.toLowerCase());
                    const isAdmin = allRoles.includes('admin') || allRoles.includes('role_admin');
                    const isDriver = allRoles.includes('driver') || allRoles.includes('role_driver');
                    role = isAdmin ? 'admin' : (isDriver ? 'driver' : 'admin');
                }

                const user: User = {
                    username: username,
                    role: role,
                    name: decoded?.name || decoded?.preferred_username || username.split('@')[0],
                    id: decoded?.sub,
                    email: decoded?.email || username
                };

                if (token) {
                    sessionStorage.setItem('token', token);
                }
                if (refreshToken) {
                    sessionStorage.setItem('refreshToken', refreshToken);
                }
                sessionStorage.setItem('currentUser', JSON.stringify(user));
                this.currentUserSubject.next(user);
            })
        );
    }

    refreshToken(): Observable<TokenResponse> {
        const refreshToken = sessionStorage.getItem('refreshToken');
        return this.http.post<TokenResponse>(`${this.AUTH_URL}/refrescar`, { refreshToken }).pipe(
            tap((response: TokenResponse) => {
                const token = response.access_token ?? response.jwtToken;
                if (token) sessionStorage.setItem('token', token);
                if (response.refresh_token) {
                    sessionStorage.setItem('refreshToken', response.refresh_token);
                }
            })
        );
    }

    logout() {
        this.clearSession();
        this.router.navigate(['/home']);
    }

    clearSession() {
        this.currentUserSubject.next(null);
        sessionStorage.removeItem('currentUser');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('refreshToken');
    }

    getCurrentUser(): User | null {
        return this.currentUserSubject.value;
    }

    getToken(): string | null {
        return sessionStorage.getItem('token');
    }

    // --- Métodos restaurados para compatibilidad con la UI ---

    getSessions(): Session[] {
        // En una implementación real, esto consultaría a Keycloak
        return [
            { id: '1', username: 'admin', role: 'admin', loginTime: new Date(), active: true }
        ];
    }

    getUsers(): any[] {
        // En una implementación real, esto consultaría al microservicio de usuarios
        return [
            { username: 'admin', name: 'Administrador', role: 'admin' },
            { username: 'conductor1', name: 'Juan Perez', role: 'driver' }
        ];
    }

    closeSession(sessionId: string): void {
        console.log('Cerrando sesión:', sessionId);
    }

    deleteUser(username: string): void {
        console.log('Eliminando usuario:', username);
    }

    resetPassword(username: string): boolean {
        console.log('Restableciendo contraseña para:', username);
        return true;
    }

    changePassword(_current: string, _newPass: string): Observable<boolean> {
        return of(true);
    }
}
