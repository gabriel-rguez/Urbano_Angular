import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService, Message, Conversation } from '../../core/services/chat.service';
import { ReportsService } from '../../core/services/reports.service';
import { Router, ActivatedRoute } from '@angular/router';
import { LayoutComponent } from '../../shared/layout/layout.component';
import { ConfirmationService } from '../../core/services/confirmation.service';

@Component({
    selector: 'app-admin-support',
    standalone: true,
    imports: [CommonModule, FormsModule, LayoutComponent],
    templateUrl: './admin-support.component.html',
    styleUrl: './admin-support.component.css'
})
export class AdminSupportComponent implements OnInit, AfterViewChecked {
    conversations: Conversation[] = [];
    selectedConversation: Conversation | null = null;
    activeMessages: Message[] = [];
    newMessage = '';

    @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

    constructor(
        private chatService: ChatService,
        private reportsService: ReportsService,
        private confirmationService: ConfirmationService,
        private router: Router,
        private route: ActivatedRoute
    ) { }

    ngOnInit() {
        this.chatService.getConversations().subscribe(convs => {
            this.conversations = convs;
            // Si hay una conversación seleccionada, actualizar sus datos (contador, etc)
            if (this.selectedConversation) {
                const updated = this.conversations.find(c => c.driverName === this.selectedConversation?.driverName);
                if (updated) {
                    this.selectedConversation = updated;
                }
            }
        });

        this.chatService.messages$.subscribe(() => {
            if (this.selectedConversation) {
                this.loadMessagesForSelected();
            }
        });

        // Check for deep link to conversation
        this.route.queryParams.subscribe(params => {
            const conversationId = params['conversationId'];
            if (conversationId && this.conversations.length > 0) {
                const target = this.conversations.find(c => c.id === conversationId);
                if (target) {
                    this.selectConversation(target);
                }
            } else if (conversationId) {
                // If conversations aren't loaded yet, try to find it after a small delay or when they load
                // (Covered by the fact that this.conversations updates might happen after)
                // Actually, let's just retry in the subscription above if needed? 
                // Simple logic: if not found, we wait for behavior subject update.
                // For now, this is sufficient if data is ready. If not, we might need a combined stream.
            }
        });
    }

    ngAfterViewChecked() {
        this.scrollToBottom();
    }

    scrollToBottom(): void {
        try {
            if (this.scrollContainer) {
                this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
            }
        } catch (err) { }
    }

    selectConversation(conversation: Conversation) {
        this.selectedConversation = conversation;
        this.loadMessagesForSelected();
    }

    loadMessagesForSelected() {
        if (!this.selectedConversation) return;
        const convId = this.selectedConversation.id;
        this.chatService.getMessagesForConversation(convId).subscribe(msgs => {
            this.activeMessages = msgs;
            // Marcar como leídos
            if (this.selectedConversation && this.selectedConversation.unreadCount > 0) {
                this.chatService.markAsRead(convId);
            }
            // Scroll tras carga
            setTimeout(() => this.scrollToBottom(), 100);
        });
    }

    sendMessage() {
        if (this.newMessage.trim() && this.selectedConversation) {
            this.chatService.sendMessage(this.newMessage, this.selectedConversation.id);
            this.newMessage = '';
        }
    }

    async createReport() {
        if (!this.selectedConversation) return;

        const result = await this.confirmationService.prompt({
            title: 'Generar Reporte de Incidencia',
            message: `Ingresa los detalles del reporte para ${this.selectedConversation.driverName}:`,
            confirmText: 'Crear Reporte',
            type: 'warning',
            inputs: [
                {
                    name: 'title',
                    label: 'Título del Problema',
                    placeholder: 'Ej: Fallo en motor, Retraso injustificado...',
                    required: true
                },
                {
                    name: 'description',
                    label: 'Descripción Detallada',
                    type: 'textarea',
                    value: `Incidencia reportada desde chat. Último mensaje: "${this.selectedConversation.lastMessage}"`,
                    required: true
                }
            ]
        });

        if (result) {
            const { title, description } = result;

            this.reportsService.createReport({
                title: title,
                driverName: this.selectedConversation.driverName,
                description: description,
                sourceConversationId: this.selectedConversation.id
            });

            // Dialogo de éxito
            const shouldNavigate = await this.confirmationService.confirm({
                title: 'Reporte Generado',
                message: 'El reporte se ha creado exitosamente. ¿Ir a la lista de reportes o continuar en el chat?',
                confirmText: 'Ir a Reportes',
                cancelText: 'Quedarse aquí',
                type: 'info'
            });

            if (shouldNavigate) {
                this.router.navigate(['/reports']);
            }
        }
    }
}
