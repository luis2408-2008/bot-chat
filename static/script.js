class LuisIA {
    constructor() {
        this.chatMessages = document.getElementById('chatMessages');
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.newChatBtn = document.getElementById('newChatBtn');
        this.welcomeMessage = document.getElementById('welcomeMessage');
        this.inputStatus = document.getElementById('inputStatus');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        
        this.isLoading = false;
        this.currentSessionId = null;
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.loadChatHistory();
        this.focusInput();
    }
    
    bindEvents() {
        // Send message on button click
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        
        // Send message on Enter key (but not Shift+Enter)
        this.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Auto-resize textarea
        this.messageInput.addEventListener('input', () => {
            this.autoResizeInput();
        });
        
        // New chat functionality
        this.newChatBtn.addEventListener('click', () => this.startNewChat());
        
        // Suggestion cards
        document.addEventListener('click', (e) => {
            if (e.target.closest('.suggestion-card')) {
                const suggestion = e.target.closest('.suggestion-card');
                const message = suggestion.getAttribute('data-message');
                this.messageInput.value = message;
                this.sendMessage();
            }
        });
        
        // Focus input when clicking anywhere in chat area
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.message') && !e.target.closest('.navbar')) {
                this.focusInput();
            }
        });
    }
    
    autoResizeInput() {
        this.messageInput.style.height = 'auto';
        const maxHeight = 120; // Maximum height in pixels
        const newHeight = Math.min(this.messageInput.scrollHeight, maxHeight);
        this.messageInput.style.height = newHeight + 'px';
    }
    
    focusInput() {
        this.messageInput.focus();
    }
    
    async sendMessage() {
        const message = this.messageInput.value.trim();
        
        if (!message || this.isLoading) {
            return;
        }
        
        // Clear input
        this.messageInput.value = '';
        this.autoResizeInput();
        
        // Hide welcome message and show chat
        this.showChatInterface();
        
        // Add user message to chat
        this.addMessage('user', message);
        
        // Show loading state
        this.setLoadingState(true);
        
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.currentSessionId = data.session_id;
                this.addMessage('assistant', data.response);
            } else {
                this.addMessage('assistant', data.error || 'Lo siento, hubo un error al procesar tu mensaje.');
            }
        } catch (error) {
            console.error('Error:', error);
            this.addMessage('assistant', 'Lo siento, no puedo conectarme en este momento. Por favor, verifica tu conexión a internet.');
        } finally {
            this.setLoadingState(false);
            this.focusInput();
        }
    }
    
    addMessage(type, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.innerHTML = type === 'user' ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        // Format message content (simple markdown-like formatting)
        const formattedContent = this.formatMessage(content);
        messageContent.innerHTML = formattedContent;
        
        const messageTime = document.createElement('div');
        messageTime.className = 'message-time';
        messageTime.textContent = this.getCurrentTime();
        
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(messageContent);
        messageContent.appendChild(messageTime);
        
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }
    
    formatMessage(content) {
        // Basic formatting for messages
        return content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
            .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
            .replace(/`(.*?)`/g, '<code>$1</code>') // Inline code
            .replace(/\n/g, '<br>'); // Line breaks
    }
    
    getCurrentTime() {
        const now = new Date();
        return now.toLocaleTimeString('es-ES', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }
    
    showChatInterface() {
        this.welcomeMessage.style.display = 'none';
        this.chatMessages.classList.add('active');
    }
    
    hideWelcomeMessage() {
        this.welcomeMessage.style.display = 'flex';
        this.chatMessages.classList.remove('active');
        this.chatMessages.innerHTML = '';
    }
    
    setLoadingState(isLoading) {
        this.isLoading = isLoading;
        this.sendBtn.disabled = isLoading;
        
        const statusIndicator = this.inputStatus.querySelector('.status-indicator');
        const statusText = this.inputStatus.querySelector('.status-text');
        
        if (isLoading) {
            statusIndicator.classList.add('thinking');
            statusText.textContent = 'Luis IA está pensando...';
            this.messageInput.disabled = true;
            
            // Show loading overlay for longer responses
            setTimeout(() => {
                if (this.isLoading) {
                    this.loadingOverlay.classList.add('active');
                }
            }, 2000);
        } else {
            statusIndicator.classList.remove('thinking');
            statusText.textContent = 'Listo para conversar';
            this.messageInput.disabled = false;
            this.loadingOverlay.classList.remove('active');
        }
    }
    
    async loadChatHistory() {
        try {
            const response = await fetch('/api/history');
            const data = await response.json();
            
            if (response.ok && data.messages && data.messages.length > 0) {
                this.showChatInterface();
                
                data.messages.forEach(msg => {
                    this.addMessage(msg.message_type, msg.content);
                });
            }
        } catch (error) {
            console.error('Error loading chat history:', error);
        }
    }
    
    async startNewChat() {
        if (this.isLoading) {
            return;
        }
        
        try {
            const response = await fetch('/api/new-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (response.ok) {
                // Clear chat and show welcome message
                this.hideWelcomeMessage();
                this.currentSessionId = null;
                this.messageInput.value = '';
                this.autoResizeInput();
                this.focusInput();
                
                // Show success feedback
                this.showNotification('Nueva conversación iniciada', 'success');
            }
        } catch (error) {
            console.error('Error starting new chat:', error);
            this.showNotification('Error al iniciar nueva conversación', 'error');
        }
    }
    
    scrollToBottom() {
        setTimeout(() => {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }, 100);
    }
    
    showNotification(message, type = 'info') {
        // Create a simple toast notification
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? 'hsl(142 71% 45%)' : type === 'error' ? 'hsl(0 84% 60%)' : 'hsl(220 100% 60%)'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            font-weight: 500;
            animation: slideInRight 0.3s ease-out;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-in forwards';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
}

// Add CSS animations for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new LuisIA();
});

// Handle visibility change to re-focus input
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        setTimeout(() => {
            const messageInput = document.getElementById('messageInput');
            if (messageInput && !messageInput.disabled) {
                messageInput.focus();
            }
        }, 100);
    }
});
