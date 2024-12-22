class LobbyChat {
    constructor() {
        this.socket = io();
        this.gameId = window.location.pathname.split("/").pop();
        this.messageContainer = document.querySelector(".chat-messages");
        this.messageInput = document.querySelector(".chat-input input");
        this.sendButton = document.querySelector(".chat-input button");

        this.initialize();
    }

    initialize() {
        this.socket.emit("lobby:join", this.gameId);

        this.socket.on("connect", () => {
            this.socket.emit("lobby:request_messages");
        });

        this.socket.on("lobby:message_history", (messages) => {
            this.loadMessageHistory(messages);
        });

        this.socket.on("lobby:new_message", (message) => {
            this.appendMessage(message);
        });

        this.socket.on("lobby:error", (error) => {
            console.error("Chat error:", error);
        });

        this.messageInput?.addEventListener("keypress", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        this.sendButton?.addEventListener("click", () => {
            this.sendMessage();
        });
    }

    loadMessageHistory(messages) {
        if (!this.messageContainer) return;

        this.messageContainer.innerHTML = "";
        messages.forEach((message) => {
            this.appendMessage(message);
        });
        this.scrollToBottom();
    }

    appendMessage(message) {
        if (!this.messageContainer) return;

        const messageElement = document.createElement("div");
        messageElement.className = "chat-message mb-2";

        messageElement.innerHTML = `
            <div class="d-flex align-items-start">
                <img src="${
                    message.avatar_url === "auth"
                        ? `/api/profile/avatar/${message.user_id}`
                        : message.avatar_url
                }"
                     alt="Avatar" 
                     class="avatar rounded-circle me-2"
                     style="width: 24px; height: 24px;">
                <div class="message-content">
                    <div class="message-header">
                        <span class="username fw-bold">${
                            message.nickname || message.username
                        }</span>
                        <span class="timestamp text-muted ms-2 small">${this.formatTimestamp(
                            new Date(message.created_at)
                        )}</span>
                    </div>
                    <div class="message-text">${this.escapeHTML(
                        message.message
                    )}</div>
                </div>
            </div>`;

        this.messageContainer.appendChild(messageElement);
        this.scrollToBottom();
    }

    sendMessage() {
        const message = this.messageInput?.value.trim();
        if (!message) return;

        this.socket.emit("lobby:message", {
            gameId: this.gameId,
            message: message,
        });

        if (this.messageInput) {
            this.messageInput.value = "";
        }
    }

    formatTimestamp(date) {
        const now = new Date();
        const diff = now - date;
        const minute = 60 * 1000;
        const hour = minute * 60;
        const day = hour * 24;

        if (diff < minute) {
            return "just now";
        } else if (diff < hour) {
            const minutes = Math.floor(diff / minute);
            return `${minutes}m ago`;
        } else if (diff < day) {
            const hours = Math.floor(diff / hour);
            return `${hours}h ago`;
        } else {
            return date.toLocaleDateString();
        }
    }

    escapeHTML(str) {
        const div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    }

    scrollToBottom() {
        if (this.messageContainer) {
            this.messageContainer.scrollTop =
                this.messageContainer.scrollHeight;
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    window.lobbyChat = new LobbyChat();
});
