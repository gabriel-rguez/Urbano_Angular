import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { AuthService } from './auth.service';

export interface Message {
    id: string;
    sender: string;
    role: 'admin' | 'driver';
    text: string;
    timestamp: Date;
    read: boolean;
    conversationId: string; // ID del conductor (username)
}

export interface Conversation {
    id: string; // ID de la conversación (username)
    driverName: string;
    lastMessage: string;
    lastMessageTime: Date;
    unreadCount: number;
}
// ... (omitting intermediate code) ...

@Injectable({
    providedIn: 'root'
})
export class ChatService {
    private messagesSubject = new BehaviorSubject<Message[]>([]);
    public messages$ = this.messagesSubject.asObservable();

    constructor(private authService: AuthService) {
        this.addMockMessages();
    }

    private addMockMessages() {
        const initialMessages: Message[] = [
            {
                id: '1',
                sender: 'Juan Pérez',
                role: 'driver',
                text: 'Hola, tengo un problema con el vehículo 54.',
                timestamp: new Date(Date.now() - 3600000), // Hace 1 hora
                read: true,
                conversationId: 'juan.perez@gmail.com'
            },
            {
                id: '2',
                sender: 'admin',
                role: 'admin',
                text: '¿Qué sucede exactamente?',
                timestamp: new Date(Date.now() - 3500000),
                read: true,
                conversationId: 'juan.perez@gmail.com'
            },
            {
                id: '3',
                sender: 'María Rodríguez',
                role: 'driver',
                text: 'Necesito reportar una avería en la ruta norte.',
                timestamp: new Date(Date.now() - 1800000), // Hace 30 min
                read: false,
                conversationId: 'maria.r@gmail.com'
            },
            {
                id: '4',
                sender: 'Carlos Ruiz',
                role: 'driver',
                text: 'El GPS no está enviando señal.',
                timestamp: new Date(Date.now() - 900000), // Hace 15 min
                read: false,
                conversationId: 'carlos.ruiz@gmail.com'
            }
        ];
        this.messagesSubject.next(initialMessages);
    }

    sendMessage(text: string, conversationId: string) {
        const currentUser = this.authService.getCurrentUser();
        if (!currentUser) return;

        const currentMessages = this.messagesSubject.value;
        const newMessage: Message = {
            id: Math.random().toString(36).substr(2, 9),
            sender: currentUser.role === 'admin' ? 'Administrador' : currentUser.username, // O nombre real
            role: currentUser.role,
            text: text,
            timestamp: new Date(),
            read: false,
            conversationId: conversationId
        };

        this.messagesSubject.next([...currentMessages, newMessage]);

        // Simular respuesta automática si es el conductor quien escribe
        if (currentUser.role === 'driver') {
            setTimeout(() => {
                this.simulateAdminResponse(conversationId);
            }, 5000);
        }
    }

    private simulateAdminResponse(conversationId: string) {
        const adminMsg: Message = {
            id: Math.random().toString(36).substr(2, 9),
            sender: 'Soporte Automático',
            role: 'admin',
            text: 'Recibido. Un administrador revisará su caso pronto.',
            timestamp: new Date(),
            read: false,
            conversationId: conversationId
        };
        this.messagesSubject.next([...this.messagesSubject.value, adminMsg]);
    }

    getMessages(): Observable<Message[]> {
        return this.messages$;
    }

    getMessagesForConversation(conversationId: string): Observable<Message[]> {
        return this.messages$.pipe(
            map(messages => messages.filter(m => m.conversationId === conversationId))
        );
    }

    getConversations(): Observable<Conversation[]> {
        return this.messages$.pipe(
            map(messages => {
                const conversationsMap = new Map<string, Conversation>();

                // Organizar por conversationId
                messages.forEach(msg => {
                    const existing = conversationsMap.get(msg.conversationId);

                    // Determinar nombre del conductor (si el mensaje es de un driver, us su sender, si no, mantener el que ya tenemos o usar el ID)
                    let driverName = existing ? existing.driverName : msg.conversationId;
                    if (msg.role === 'driver') {
                        driverName = msg.sender;
                    }

                    // Contador de no leídos: solo contar mensajes de drivers que no están leídos
                    let unread = existing ? existing.unreadCount : 0;
                    if (msg.role === 'driver' && !msg.read) {
                        unread++;
                    }

                    // Último mensaje
                    let lastMsg = existing ? existing.lastMessage : msg.text;
                    let lastTime = existing ? existing.lastMessageTime : msg.timestamp;

                    if (msg.timestamp > lastTime) {
                        lastMsg = msg.text;
                        lastTime = msg.timestamp;
                    }

                    conversationsMap.set(msg.conversationId, {
                        id: msg.conversationId,
                        driverName: driverName,
                        lastMessage: lastMsg,
                        lastMessageTime: lastTime,
                        unreadCount: unread
                    });
                });

                return Array.from(conversationsMap.values()).sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime());
            })
        );
    }

    markAsRead(conversationId: string) {
        const currentMessages = this.messagesSubject.value;
        const updatedMessages = currentMessages.map(msg => {
            if (msg.conversationId === conversationId && msg.role === 'driver' && !msg.read) {
                return { ...msg, read: true };
            }
            return msg;
        });
        this.messagesSubject.next(updatedMessages);
    }
}
