// Application state
class OllamaChat {
    constructor() {
        this.settings = {
            endpoint: 'http://localhost:11434',
            defaultModel: ''
        };
        this.chats = new Map();
        this.currentChatId = null;
        this.models = [];
        this.systemPrompts = new Map();
        this.isConnected = false;
        this.currentImage = null;
        
        this.init();
    }

    async init() {
        this.loadSettings();
        this.loadChats();
        this.loadSystemPrompts();
        this.setupEventListeners();
        this.updateUI();
        await this.checkConnection();
    }

    // Settings management
    loadSettings() {
        const saved = localStorage.getItem('ollama-settings');
        if (saved) {
            this.settings = { ...this.settings, ...JSON.parse(saved) };
        }
    }

    saveSettings() {
        localStorage.setItem('ollama-settings', JSON.stringify(this.settings));
    }

    // Chat management
    loadChats() {
        const saved = localStorage.getItem('ollama-chats');
        if (saved) {
            const chatsData = JSON.parse(saved);
            this.chats = new Map(chatsData);
        }
    }

    saveChats() {
        const chatsArray = Array.from(this.chats.entries());
        localStorage.setItem('ollama-chats', JSON.stringify(chatsArray));
    }

    createNewChat() {
        const chatId = Date.now().toString();
        const chat = {
            id: chatId,
            title: 'New Chat',
            model: this.settings.defaultModel || '',
            messages: [],
            systemPrompt: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        this.chats.set(chatId, chat);
        this.currentChatId = chatId;
        this.saveChats();
        this.updateUI();
        this.showChatContainer();
        
        return chat;
    }

    deleteChat(chatId) {
        if (this.chats.has(chatId)) {
            this.chats.delete(chatId);
            if (this.currentChatId === chatId) {
                this.currentChatId = null;
                this.showWelcomeScreen();
            }
            this.saveChats();
            this.updateUI();
        }
    }

    getCurrentChat() {
        return this.currentChatId ? this.chats.get(this.currentChatId) : null;
    }

    updateChatTitle(chatId, title) {
        const chat = this.chats.get(chatId);
        if (chat) {
            chat.title = title;
            chat.updatedAt = new Date().toISOString();
            this.saveChats();
            this.updateUI();
        }
    }

    // System prompts management
    loadSystemPrompts() {
        const saved = localStorage.getItem('ollama-system-prompts');
        if (saved) {
            const promptsData = JSON.parse(saved);
            this.systemPrompts = new Map(promptsData);
        }
        
        // Add default prompts if none exist
        if (this.systemPrompts.size === 0) {
            this.systemPrompts.set('helpful', {
                name: 'Helpful Assistant',
                prompt: 'You are a helpful, harmless, and honest AI assistant. Provide clear, accurate, and useful responses.'
            });
            this.systemPrompts.set('creative', {
                name: 'Creative Writer',
                prompt: 'You are a creative writing assistant. Help with storytelling, character development, and creative expression.'
            });
            this.systemPrompts.set('technical', {
                name: 'Technical Expert',
                prompt: 'You are a technical expert. Provide detailed, accurate technical information and help solve complex problems.'
            });
            this.saveSystemPrompts();
        }
    }

    saveSystemPrompts() {
        const promptsArray = Array.from(this.systemPrompts.entries());
        localStorage.setItem('ollama-system-prompts', JSON.stringify(promptsArray));
    }

    // API communication
    async checkConnection() {
        this.updateConnectionStatus('connecting');
        
        try {
            const response = await fetch(`${this.settings.endpoint}/api/version`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            
            if (response.ok) {
                this.isConnected = true;
                this.updateConnectionStatus('connected');
                await this.loadModels();
            } else {
                throw new Error('Connection failed');
            }
        } catch (error) {
            this.isConnected = false;
            this.updateConnectionStatus('disconnected');
            console.error('Connection error:', error);
        }
    }

    async loadModels() {
        try {
            const response = await fetch(`${this.settings.endpoint}/api/tags`);
            if (response.ok) {
                const data = await response.json();
                this.models = data.models || [];
                this.updateModelSelect();
            }
        } catch (error) {
            console.error('Error loading models:', error);
        }
    }

    async sendMessage(content, image = null) {
        const chat = this.getCurrentChat();
        if (!chat) return;

        // Add user message
        const userMessage = {
            role: 'user',
            content: content,
            timestamp: new Date().toISOString()
        };

        if (image) {
            userMessage.images = [image];
        }

        chat.messages.push(userMessage);
        chat.updatedAt = new Date().toISOString();

        // Update title if this is the first message
        if (chat.messages.length === 1) {
            const title = content.length > 50 ? content.substring(0, 50) + '...' : content;
            this.updateChatTitle(chat.id, title);
        }

        this.saveChats();
        this.renderMessages();
        this.showTypingIndicator();

        try {
            // Prepare messages for API
            const messages = [];
            
            // Add system prompt if exists
            if (chat.systemPrompt) {
                messages.push({
                    role: 'system',
                    content: chat.systemPrompt
                });
            }

            // Add chat messages
            messages.push(...chat.messages.map(msg => ({
                role: msg.role,
                content: msg.content,
                ...(msg.images && { images: msg.images })
            })));

            const response = await fetch(`${this.settings.endpoint}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: chat.model,
                    messages: messages,
                    stream: true
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Handle streaming response
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let assistantMessage = {
                role: 'assistant',
                content: '',
                timestamp: new Date().toISOString()
            };

            this.hideTypingIndicator();
            chat.messages.push(assistantMessage);
            this.renderMessages();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(line => line.trim());

                for (const line of lines) {
                    try {
                        const data = JSON.parse(line);
                        if (data.message && data.message.content) {
                            assistantMessage.content += data.message.content;
                            this.renderMessages();
                            this.scrollToBottom();
                        }
                    } catch (e) {
                        // Ignore JSON parse errors for incomplete chunks
                    }
                }
            }

            chat.updatedAt = new Date().toISOString();
            this.saveChats();
            this.updateUI();

        } catch (error) {
            this.hideTypingIndicator();
            console.error('Error sending message:', error);
            
            // Add error message
            chat.messages.push({
                role: 'assistant',
                content: 'Sorry, I encountered an error while processing your message. Please check your connection and try again.',
                timestamp: new Date().toISOString(),
                isError: true
            });
            
            this.renderMessages();
            this.saveChats();
        }
    }

    // UI management
    updateConnectionStatus(status) {
        const indicator = document.getElementById('statusIndicator');
        const text = document.getElementById('statusText');
        
        indicator.className = 'status-indicator';
        
        switch (status) {
            case 'connected':
                indicator.classList.add('connected');
                text.textContent = 'Connected';
                break;
            case 'connecting':
                indicator.classList.add('connecting');
                text.textContent = 'Connecting...';
                break;
            default:
                text.textContent = 'Disconnected';
        }
    }

    updateModelSelect() {
        const select = document.getElementById('defaultModel');
        select.innerHTML = '<option value="">Select a model...</option>';
        
        this.models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.name;
            option.textContent = model.name;
            if (model.name === this.settings.defaultModel) {
                option.selected = true;
            }
            select.appendChild(option);
        });
    }

    updateUI() {
        this.renderChatList();
        this.renderCurrentChat();
        this.updateSystemPromptSelect();
    }

    renderChatList() {
        const chatList = document.getElementById('chatList');
        chatList.innerHTML = '';

        const sortedChats = Array.from(this.chats.values())
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

        sortedChats.forEach(chat => {
            const chatItem = document.createElement('div');
            chatItem.className = `chat-item ${chat.id === this.currentChatId ? 'active' : ''}`;
            chatItem.onclick = () => this.selectChat(chat.id);

            const lastMessage = chat.messages[chat.messages.length - 1];
            const preview = lastMessage ? 
                (lastMessage.content.length > 60 ? lastMessage.content.substring(0, 60) + '...' : lastMessage.content) : 
                'No messages yet';

            chatItem.innerHTML = `
                <div class="chat-item-title">${chat.title}</div>
                <div class="chat-item-meta">
                    <span>${preview}</span>
                    <span>${this.formatDate(chat.updatedAt)}</span>
                </div>
            `;

            chatList.appendChild(chatItem);
        });
    }

    renderCurrentChat() {
        const chat = this.getCurrentChat();
        if (!chat) return;

        document.getElementById('chatTitle').textContent = chat.title;
        document.getElementById('chatModel').textContent = chat.model || 'No model selected';
        
        this.renderMessages();
    }

    renderMessages() {
        const container = document.getElementById('messagesContainer');
        const chat = this.getCurrentChat();
        
        if (!chat) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = '';

        chat.messages.forEach(message => {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${message.role}`;

            const avatar = document.createElement('div');
            avatar.className = 'message-avatar';
            avatar.textContent = message.role === 'user' ? 'U' : 'A';

            const content = document.createElement('div');
            content.className = 'message-content';

            const bubble = document.createElement('div');
            bubble.className = 'message-bubble';

            if (message.images && message.images.length > 0) {
                const img = document.createElement('img');
                img.className = 'message-image';
                img.src = `data:image/jpeg;base64,${message.images[0]}`;
                bubble.appendChild(img);
            }

            const text = document.createElement('div');
            text.className = 'message-text';
            text.textContent = message.content;
            bubble.appendChild(text);

            const time = document.createElement('div');
            time.className = 'message-time';
            time.textContent = this.formatTime(message.timestamp);
            bubble.appendChild(time);

            content.appendChild(bubble);
            messageDiv.appendChild(avatar);
            messageDiv.appendChild(content);
            container.appendChild(messageDiv);
        });

        this.scrollToBottom();
    }

    showTypingIndicator() {
        const container = document.getElementById('messagesContainer');
        const indicator = document.createElement('div');
        indicator.className = 'typing-indicator';
        indicator.id = 'typingIndicator';

        indicator.innerHTML = `
            <div class="message-avatar">A</div>
            <div class="typing-dots">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;

        container.appendChild(indicator);
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        const indicator = document.getElementById('typingIndicator');
        if (indicator) {
            indicator.remove();
        }
    }

    updateSystemPromptSelect() {
        const select = document.getElementById('systemPromptSelect');
        select.innerHTML = '<option value="">Select a saved prompt...</option>';
        
        this.systemPrompts.forEach((prompt, key) => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = prompt.name;
            select.appendChild(option);
        });
    }

    selectChat(chatId) {
        this.currentChatId = chatId;
        this.updateUI();
        this.showChatContainer();
    }

    showWelcomeScreen() {
        document.getElementById('welcomeScreen').style.display = 'flex';
        document.getElementById('chatContainer').style.display = 'none';
    }

    showChatContainer() {
        document.getElementById('welcomeScreen').style.display = 'none';
        document.getElementById('chatContainer').style.display = 'flex';
    }

    scrollToBottom() {
        const container = document.getElementById('messagesContainer');
        container.scrollTop = container.scrollHeight;
    }

    // Modal management
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.classList.add('show');
    }

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.classList.remove('show');
    }

    // Utility functions
    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) {
            return 'Today';
        } else if (days === 1) {
            return 'Yesterday';
        } else if (days < 7) {
            return `${days} days ago`;
        } else {
            return date.toLocaleDateString();
        }
    }

    formatTime(dateString) {
        return new Date(dateString).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    // Image handling
    async handleImageUpload(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async () => {
                try {
                    const resizedBase64 = await this.resizeImage(reader.result, 800);
                    resolve(resizedBase64);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async resizeImage(dataUrl, maxDimension) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                try {
                    // Calculate new dimensions
                    let { width, height } = img;
                    
                    // Only resize if image is larger than maxDimension
                    if (width <= maxDimension && height <= maxDimension) {
                        // Image is already small enough, return original base64
                        resolve(dataUrl.split(',')[1]);
                        return;
                    }
                    
                    // Calculate scaling factor
                    const scaleFactor = Math.min(maxDimension / width, maxDimension / height);
                    const newWidth = Math.floor(width * scaleFactor);
                    const newHeight = Math.floor(height * scaleFactor);
                    
                    // Create canvas and resize
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    canvas.width = newWidth;
                    canvas.height = newHeight;
                    
                    // Use high-quality scaling
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    
                    // Draw resized image
                    ctx.drawImage(img, 0, 0, newWidth, newHeight);
                    
                    // Convert to base64 (JPEG with 85% quality for good compression)
                    const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
                    resolve(resizedDataUrl.split(',')[1]);
                } catch (error) {
                    reject(error);
                }
            };
            img.onerror = reject;
            img.src = dataUrl;
        });
    }

    async handleImagePaste(clipboardData) {
        const items = clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.indexOf('image') !== -1) {
                const file = item.getAsFile();
                if (file) {
                    try {
                        const base64 = await this.handleImageUpload(file);
                        this.currentImage = base64;
                        
                        const preview = document.getElementById('imagePreview');
                        const previewImg = document.getElementById('previewImage');
                        previewImg.src = `data:image/jpeg;base64,${base64}`;
                        preview.style.display = 'block';
                        
                        // Update send button state
                        const messageInput = document.getElementById('messageInput');
                        const sendBtn = document.getElementById('sendBtn');
                        const hasText = messageInput.value.trim().length > 0;
                        const hasImage = this.currentImage !== null;
                        sendBtn.disabled = !hasText && !hasImage;
                        
                        return true;
                    } catch (error) {
                        console.error('Error processing pasted image:', error);
                        alert('Error processing pasted image. Please try again.');
                        return false;
                    }
                }
            }
        }
        return false;
    }

    async resetChat() {
        const chat = this.getCurrentChat();
        if (!chat) return;

        if (!confirm('Are you sure you want to reset this chat? This will clear all messages and context on the server.')) {
            return;
        }

        try {
            // Clear context on Ollama server by sending a reset request
            if (this.isConnected && chat.model) {
                await fetch(`${this.settings.endpoint}/api/chat`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: chat.model,
                        messages: [],
                        stream: false,
                        keep_alive: 0 // This tells Ollama to unload the model and clear context
                    })
                });
            }
        } catch (error) {
            console.warn('Could not clear server context:', error);
            // Continue with local reset even if server reset fails
        }

        // Clear local chat messages
        chat.messages = [];
        chat.updatedAt = new Date().toISOString();
        
        // Reset title to default
        this.updateChatTitle(chat.id, 'New Chat');
        
        this.saveChats();
        this.renderMessages();
        this.updateUI();
        
        // Clear any current image
        if (this.currentImage) {
            this.currentImage = null;
            document.getElementById('imagePreview').style.display = 'none';
            document.getElementById('imageInput').value = '';
        }
        
        // Clear input
        const messageInput = document.getElementById('messageInput');
        messageInput.value = '';
        messageInput.style.height = 'auto';
        document.getElementById('sendBtn').disabled = true;
    }

    // Event listeners setup
    setupEventListeners() {
        // Header buttons
        document.getElementById('settingsBtn').onclick = () => {
            document.getElementById('ollamaEndpoint').value = this.settings.endpoint;
            document.getElementById('defaultModel').value = this.settings.defaultModel;
            this.showModal('settingsModal');
        };

        document.getElementById('newChatBtn').onclick = () => {
            this.createNewChat();
        };

        // Welcome screen buttons
        document.getElementById('welcomeNewChat').onclick = () => {
            this.createNewChat();
        };

        document.getElementById('welcomeSettings').onclick = () => {
            document.getElementById('ollamaEndpoint').value = this.settings.endpoint;
            document.getElementById('defaultModel').value = this.settings.defaultModel;
            this.showModal('settingsModal');
        };

        // Settings modal
        document.getElementById('closeSettings').onclick = () => {
            this.hideModal('settingsModal');
        };

        document.getElementById('cancelSettings').onclick = () => {
            this.hideModal('settingsModal');
        };

        document.getElementById('testConnection').onclick = async () => {
            const endpoint = document.getElementById('ollamaEndpoint').value;
            const result = document.getElementById('connectionTestResult');
            
            result.style.display = 'block';
            result.className = 'connection-test-result';
            result.textContent = 'Testing connection...';

            try {
                const response = await fetch(`${endpoint}/api/version`);
                if (response.ok) {
                    result.classList.add('success');
                    result.textContent = 'Connection successful!';
                } else {
                    throw new Error('Connection failed');
                }
            } catch (error) {
                result.classList.add('error');
                result.textContent = 'Connection failed. Please check the endpoint URL.';
            }
        };

        document.getElementById('saveSettings').onclick = async () => {
            this.settings.endpoint = document.getElementById('ollamaEndpoint').value;
            this.settings.defaultModel = document.getElementById('defaultModel').value;
            this.saveSettings();
            this.hideModal('settingsModal');
            await this.checkConnection();
        };

        // System prompt modal
        document.getElementById('systemPromptBtn').onclick = () => {
            const chat = this.getCurrentChat();
            if (chat) {
                document.getElementById('systemPromptText').value = chat.systemPrompt || '';
                document.getElementById('promptName').value = '';
                this.showModal('systemPromptModal');
            }
        };

        document.getElementById('closeSystemPrompt').onclick = () => {
            this.hideModal('systemPromptModal');
        };

        document.getElementById('cancelSystemPrompt').onclick = () => {
            this.hideModal('systemPromptModal');
        };

        document.getElementById('systemPromptSelect').onchange = (e) => {
            const promptKey = e.target.value;
            if (promptKey && this.systemPrompts.has(promptKey)) {
                const prompt = this.systemPrompts.get(promptKey);
                document.getElementById('systemPromptText').value = prompt.prompt;
            }
        };

        document.getElementById('savePromptTemplate').onclick = () => {
            const name = document.getElementById('promptName').value.trim();
            const prompt = document.getElementById('systemPromptText').value.trim();
            
            if (name && prompt) {
                const key = name.toLowerCase().replace(/\s+/g, '-');
                this.systemPrompts.set(key, { name, prompt });
                this.saveSystemPrompts();
                this.updateSystemPromptSelect();
                document.getElementById('promptName').value = '';
                alert('Prompt template saved successfully!');
            } else {
                alert('Please enter both a name and prompt text.');
            }
        };

        document.getElementById('applySystemPrompt').onclick = () => {
            const chat = this.getCurrentChat();
            if (chat) {
                chat.systemPrompt = document.getElementById('systemPromptText').value;
                this.saveChats();
                this.hideModal('systemPromptModal');
            }
        };

        // Chat actions
        document.getElementById('resetChatBtn').onclick = () => {
            this.resetChat();
        };

        document.getElementById('deleteChatBtn').onclick = () => {
            if (this.currentChatId && confirm('Are you sure you want to delete this chat?')) {
                this.deleteChat(this.currentChatId);
            }
        };

        // Image upload
        document.getElementById('imageBtn').onclick = () => {
            document.getElementById('imageInput').click();
        };

        document.getElementById('imageInput').onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const base64 = await this.handleImageUpload(file);
                    this.currentImage = base64;
                    
                    const preview = document.getElementById('imagePreview');
                    const previewImg = document.getElementById('previewImage');
                    previewImg.src = `data:image/jpeg;base64,${base64}`;
                    preview.style.display = 'block';
                } catch (error) {
                    console.error('Error uploading image:', error);
                    alert('Error uploading image. Please try again.');
                }
            }
        };

        document.getElementById('removeImage').onclick = () => {
            this.currentImage = null;
            document.getElementById('imagePreview').style.display = 'none';
            document.getElementById('imageInput').value = '';
        };

        // Message input
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');

        messageInput.oninput = () => {
            // Auto-resize textarea
            messageInput.style.height = 'auto';
            messageInput.style.height = messageInput.scrollHeight + 'px';
            
            // Enable/disable send button
            const hasText = messageInput.value.trim().length > 0;
            const hasImage = this.currentImage !== null;
            sendBtn.disabled = !hasText && !hasImage;
        };

        messageInput.onkeydown = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSendMessage();
            }
        };

        // Paste event for images
        messageInput.onpaste = async (e) => {
            const clipboardData = e.clipboardData || window.clipboardData;
            if (clipboardData) {
                const handled = await this.handleImagePaste(clipboardData);
                if (handled) {
                    e.preventDefault();
                }
            }
        };

        // Also listen for paste events on the document for global paste support
        document.addEventListener('paste', async (e) => {
            // Only handle paste if we're in a chat and the message input is focused or visible
            const chat = this.getCurrentChat();
            const chatContainer = document.getElementById('chatContainer');
            if (chat && chatContainer.style.display !== 'none') {
                const clipboardData = e.clipboardData || window.clipboardData;
                if (clipboardData) {
                    const handled = await this.handleImagePaste(clipboardData);
                    if (handled) {
                        e.preventDefault();
                        // Focus the message input after pasting an image
                        messageInput.focus();
                    }
                }
            }
        });

        sendBtn.onclick = () => {
            this.handleSendMessage();
        };

        // Modal backdrop clicks
        document.querySelectorAll('.modal').forEach(modal => {
            modal.onclick = (e) => {
                if (e.target === modal) {
                    modal.classList.remove('show');
                }
            };
        });
    }

    async handleSendMessage() {
        const messageInput = document.getElementById('messageInput');
        const content = messageInput.value.trim();
        
        if (!content && !this.currentImage) return;
        
        const chat = this.getCurrentChat();
        if (!chat) {
            this.createNewChat();
        }

        if (!this.isConnected) {
            alert('Not connected to Ollama server. Please check your settings.');
            return;
        }

        if (!chat.model) {
            alert('Please select a model in the settings.');
            return;
        }

        await this.sendMessage(content, this.currentImage);
        
        // Clear input
        messageInput.value = '';
        messageInput.style.height = 'auto';
        document.getElementById('sendBtn').disabled = true;
        
        // Clear image
        if (this.currentImage) {
            this.currentImage = null;
            document.getElementById('imagePreview').style.display = 'none';
            document.getElementById('imageInput').value = '';
        }
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    window.ollamaChat = new OllamaChat();
});
