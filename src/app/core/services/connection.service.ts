import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient, HttpContext, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { BehaviorSubject, fromEvent, interval, merge, of, Subject, timeout } from 'rxjs';
import { catchError, map, startWith, switchMap, takeUntil } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { SKIP_SESSION_RESET } from '../interceptors/auth.interceptor';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class ConnectionService implements OnDestroy {
  private readonly connectedSubject = new BehaviorSubject<boolean>(false);
  readonly connected$ = this.connectedSubject.asObservable();

  private readonly destroy$ = new Subject<void>();
  private readonly pingUrl = `${environment.apiUrl}/Vehiculo/v1/sugerencia`;
  private readonly pingContext = new HttpContext().set(SKIP_SESSION_RESET, true);

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    this.authService.currentUser$.pipe(
      switchMap(user => {
        if (user?.role !== 'admin') {
          return of(false);
        }

        const offline$ = fromEvent(window, 'offline').pipe(map(() => false));
        const polls$ = interval(15000).pipe(
          startWith(0),
          switchMap(() => this.pingBackend())
        );

        return merge(offline$, polls$);
      }),
      takeUntil(this.destroy$)
    ).subscribe(connected => this.connectedSubject.next(connected));
  }

  get isConnected(): boolean {
    return this.connectedSubject.value;
  }

  private pingBackend() {
    if (!navigator.onLine) {
      return of(false);
    }

    const params = new HttpParams().set('matricula', '_');
    return this.http.get(this.pingUrl, {
      params,
      observe: 'response',
      responseType: 'text',
      context: this.pingContext
    }).pipe(
      timeout(5000),
      map(response => this.isServerUp(response.status)),
      catchError((error: unknown) => of(this.isErrorServerUp(error)))
    );
  }

  private isServerUp(status: number): boolean {
    return status > 0 && ![0, 502, 503, 504].includes(status);
  }

  private isErrorServerUp(error: unknown): boolean {
    if (error instanceof HttpErrorResponse) {
      return this.isServerUp(error.status);
    }
    return false;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
