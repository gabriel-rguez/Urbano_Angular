import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { Router } from '@angular/router';

export interface User {
    username: string;
    role: 'admin' | 'driver';
    name: string;
    password?: string; // Solo para simulación
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

    private sessions: Session[] = [];

    // Base de datos simulada en memoria
    private users: User[] = [
        { username: 'admin@gmail.com', role: 'admin', name: 'Administrador Principal', password: 'admin' },
        { username: 'conductor@gmail.com', role: 'driver', name: 'Conductor Demo', password: 'driver' },
        { username: 'juan.perez@gmail.com', role: 'driver', name: 'Juan Perez', password: 'driver' },
        { username: 'maria.r@gmail.com', role: 'driver', name: 'Maria Rodriguez', password: 'driver' }
    ];

    constructor(private router: Router) {
        this.loadSession();
    }

    private loadSession() {
        const savedUser = sessionStorage.getItem('currentUser');
        if (savedUser) {
            this.currentUserSubject.next(JSON.parse(savedUser));
        }
    }

    login(username: string, password: string): Observable<boolean> {
        return new Observable(observer => {
            setTimeout(() => {
                const user = this.users.find(u => u.username === username && u.password === password);

                if (user) {
                    // Crear copia segura sin password
                    const safeUser = { ...user };
                    delete safeUser.password;

                    this.currentUserSubject.next(safeUser);
                    sessionStorage.setItem('currentUser', JSON.stringify(safeUser));
                    this.recordSession(safeUser);
                    observer.next(true);
                } else {
                    observer.next(false);
                }
                observer.complete();
            }, 500);
        });
    }

    logout() {
        this.currentUserSubject.next(null);
        sessionStorage.removeItem('currentUser');
        this.router.navigate(['/login']);
    }

    // Métodos de Gestión de Usuarios

    getUsers(): User[] {
        // Retornar copia para evitar modificaciones directas
        return this.users.map(u => {
            const { password, ...safeUser } = u;
            return safeUser as User;
        });
    }

    changePassword(currentPass: string, newPass: string): Observable<boolean> {
        const currentUser = this.currentUserSubject.value;
        if (!currentUser) return of(false);

        const userIndex = this.users.findIndex(u => u.username === currentUser.username);
        if (userIndex !== -1 && this.users[userIndex].password === currentPass) {
            this.users[userIndex].password = newPass;
            return of(true);
        }
        return of(false);
    }

    // Admin Methods

    closeSession(sessionId: string) {
        const session = this.sessions.find(s => s.id === sessionId);
        if (session) {
            session.active = false;
        }
    }

    resetPassword(username: string, newPass: string = '123456') {
        const user = this.users.find(u => u.username === username);
        if (user) {
            user.password = newPass;
            return true;
        }
        return false;
    }

    deleteUser(username: string) {
        this.users = this.users.filter(u => u.username !== username);
    }

    private recordSession(user: User) {
        const session: Session = {
            id: Math.random().toString(36).substr(2, 9),
            username: user.username,
            role: user.role,
            loginTime: new Date(),
            active: true
        };
        this.sessions.unshift(session);
    }

    getSessions(): Session[] {
        return this.sessions;
    }

    getCurrentUser(): User | null {
        return this.currentUserSubject.value;
    }
}
