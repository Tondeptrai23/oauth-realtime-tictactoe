class HomeChatManager {
    constructor() {
        this.socket = io();
        this.chatMessages = document.getElementById("chatMessages");
        this.messageInput = document.getElementById("messageInput");
        this.sendButton = document.getElementById("sendMessage");
        this.messageTemplate = document.getElementById("chatMessageTemplate");

        this.initialize();
    }

    initialize() {
        // Request chat history immediately and when reconnecting
        this.requestChatHistory();

        this.socket.on("connect", () => {
            this.requestChatHistory();
        });

        // Listen for new messages
        this.socket.on("chat:message", (message) => {
            this.appendMessage(message);
        });

        // Load chat history
        this.socket.on("chat:history", (messages) => {
            console.log("Received chat history:", messages);
            this.loadChatHistory(messages);
        });

        // Handle errors
        this.socket.on("chat:error", (error) => {
            console.error("Chat error:", error);
        });

        this.sendButton.addEventListener("click", () => {
            this.sendMessage();
        });

        this.messageInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
    }

    requestChatHistory() {
        this.socket.emit("chat:history");
    }

    sendMessage() {
        const message = this.messageInput.value.trim();
        if (message) {
            this.socket.emit("chat:message", message);
            this.messageInput.value = "";
        }
    }

    loadChatHistory(messages) {
        if (!this.chatMessages || !this.messageTemplate) {
            console.error("Required DOM elements not found!");
            return;
        }

        this.chatMessages.innerHTML = "";
        messages.forEach((message) => {
            this.appendMessage(message);
        });
        this.scrollToBottom();
    }

    appendMessage(message) {
        const messageElement = this.createMessageElement(message);
        this.chatMessages.appendChild(messageElement);
        this.scrollToBottom();
    }

    createMessageElement(message) {
        if (!this.messageTemplate) {
            console.error("Message template not found!");
            return document.createElement("div");
        }

        try {
            const template = this.messageTemplate.content.cloneNode(true);
            const messageContainer = template.querySelector(".chat-message");

            console.log("Creating message element:", message);

            const avatar = messageContainer.querySelector(".avatar");
            avatar.src =
                message.avatar_url === "auth"
                    ? `/api/profile/avatar/${message.user_id}`
                    : message.avatar_url;
            avatar.alt = `${message.username}'s avatar`;

            messageContainer.querySelector(".username").textContent =
                message.nickname || message.username;

            messageContainer.querySelector(".timestamp").textContent =
                this.formatTimestamp(new Date(message.created_at));

            messageContainer.querySelector(".message-text").textContent =
                message.message;

            return messageContainer;
        } catch (error) {
            console.error("Error creating message element:", error);
            return document.createElement("div");
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

    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    window.chatManager = new HomeChatManager();
});
