import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { map, take } from 'rxjs/operators';

@Injectable({
    providedIn: 'root'
})
export class AuthGuard implements CanActivate {
    constructor(private authService: AuthService, private router: Router) { }

    canActivate(
        route: ActivatedRouteSnapshot
    ): Observable<boolean | UrlTree> {
        return this.authService.currentUser$.pipe(
            take(1),
            map(user => {
                const isAuth = !!user;
                if (!isAuth) {
                    return this.router.createUrlTree(['/login']);
                }

                // Role check
                const roles = route.data['roles'] as Array<string>;
                if (roles && roles.length > 0) {
                    if (roles.includes(user.role)) {
                        return true;
                    } else {
                        // Unauthorized for this role, go home
                        return this.router.createUrlTree(['/home']);
                    }
                }

                // If no roles specified, just being logged in is enough (or default to admin only?)
                // Let's assume standard routes are admin only unless specified
                return true;
            })
        );
    }
}
