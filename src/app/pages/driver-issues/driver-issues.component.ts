import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService, Message } from '../../core/services/chat.service';
import { AuthService, User } from '../../core/services/auth.service';
import { Router } from '@angular/router';
import { LayoutComponent } from '../../shared/layout/layout.component';

@Component({
    selector: 'app-driver-issues',
    standalone: true,
    imports: [CommonModule, FormsModule, LayoutComponent],
    templateUrl: './driver-issues.component.html',
    styleUrl: './driver-issues.component.css'
})
export class DriverIssuesComponent implements OnInit, AfterViewChecked {
    messages: Message[] = [];
    newMessage = '';
    currentUser: User | null = null;
    @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

    constructor(
        private chatService: ChatService,
        private authService: AuthService,
        private router: Router
    ) { }

    ngOnInit() {
        this.currentUser = this.authService.getCurrentUser();
        if (!this.currentUser || this.currentUser.role !== 'driver') {
            this.router.navigate(['/login']);
            return;
        }

        // Suscribirse solo a los mensajes de este conductor
        this.chatService.getMessagesForConversation(this.currentUser.username).subscribe(msgs => {
            this.messages = msgs;
            setTimeout(() => this.scrollToBottom(), 100);
        });
    }

    ngAfterViewChecked() {
        this.scrollToBottom();
    }

    scrollToBottom(): void {
        try {
            this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
        } catch (err) { }
    }

    sendMessage() {
        if (this.newMessage.trim() && this.currentUser) {
            this.chatService.sendMessage(this.newMessage, this.currentUser.username);
            this.newMessage = '';
        }
    }

    logout() {
        this.authService.logout();
    }
}
