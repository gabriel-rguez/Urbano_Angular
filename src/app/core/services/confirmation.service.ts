
import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

export interface InputField {
    name: string;
    label: string;
    type?: 'text' | 'textarea' | 'select' | 'color'; // added color just in case, though selectColorFromPalette is custom
    value?: string;
    placeholder?: string;
    required?: boolean;
}

export interface ConfirmationOptions {
    title?: string;
    message?: string;
    htmlContent?: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info' | 'primary';
    inputs?: InputField[];
}

@Injectable({
    providedIn: 'root'
})
export class ConfirmationService {
    private confirmationSubject = new Subject<ConfirmationOptions>();
    private resultSubject = new Subject<any>(); // Changed to any to support objects

    confirmState$ = this.confirmationSubject.asObservable();

    confirm(options: ConfirmationOptions): Promise<boolean> {
        return new Promise((resolve) => {
            this.confirmationSubject.next(options);
            const subscription = this.resultSubject.subscribe((result) => {
                resolve(!!result); // Force boolean
                subscription.unsubscribe();
            });
        });
    }

    prompt(options: ConfirmationOptions): Promise<Record<string, string> | null> {
        return new Promise((resolve) => {
            this.confirmationSubject.next(options);
            const subscription = this.resultSubject.subscribe((result) => {
                if (result === false || result === null) {
                    resolve(null);
                } else {
                    resolve(result as Record<string, string>);
                }
                subscription.unsubscribe();
            });
        });
    }

    accept(value: any = true) {
        this.resultSubject.next(value);
    }

    cancel() {
        this.resultSubject.next(false);
    }
}
