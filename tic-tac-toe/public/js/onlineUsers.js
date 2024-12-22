class OnlineUsersManager {
    constructor() {
        this.socket = io();
        this.usersList = new Map();
        this.currentUser = null;

        this.onlineUsersContainer =
            document.querySelector(".online-users-list");
        this.onlineCountBadge = document.getElementById("onlineCount");
        this.userCardTemplate = document.getElementById("userCardTemplate");

        this.initialize();
    }

    initialize() {
        this.socket.on("connect", () => {
            console.log("Connected to server");
        });

        this.socket.on("users:update", (users) => {
            this.updateOnlineUsers(users);
        });

        this.socket.on("disconnect", () => {
            console.log("Disconnected from server");
            this.clearOnlineUsers();
        });

        this.socket.on("connect_error", (error) => {
            console.error("Connection error:", error);
        });
    }

    updateOnlineUsers(users) {
        this.usersList.clear();
        users.forEach((user) => {
            this.usersList.set(user.id, user);
        });

        this.renderOnlineUsers();
        this.updateOnlineCount();
    }

    renderOnlineUsers() {
        this.onlineUsersContainer.innerHTML = "";

        const sortedUsers = Array.from(this.usersList.values()).sort((a, b) => {
            if (a.status === b.status) {
                return a.username.localeCompare(b.username);
            }
            return a.status === "online" ? -1 : 1;
        });

        sortedUsers.forEach((user) => {
            const userCard = this.createUserCard(user);
            this.onlineUsersContainer.appendChild(userCard);
        });
    }

    createUserCard(user) {
        const template = this.userCardTemplate.content.cloneNode(true);
        const card = template.querySelector(".user-card");

        const avatar = card.querySelector(".avatar");

        avatar.src =
            user.avatarUrl === "auth"
                ? "/images/default-avatar.png"
                : user.avatarUrl;
        avatar.alt = `${user.username}'s avatar`;

        card.querySelector(".username").textContent =
            user.nickname || user.username;
        card.querySelector(".rating").textContent = `Rating: ${user.rating}`;

        const statusIndicator = card.querySelector(".status-indicator");
        statusIndicator.classList.add(
            user.status === "online" ? "bg-success" : "bg-secondary"
        );
        statusIndicator.style.width = "8px";
        statusIndicator.style.height = "8px";
        statusIndicator.style.borderRadius = "50%";
        statusIndicator.style.display = "inline-block";

        if (user.currentGame) {
            const gameStatus = document.createElement("small");
            gameStatus.classList.add("text-muted", "ms-2");
            gameStatus.textContent = "In Game";
            card.querySelector(".user-info").appendChild(gameStatus);
        }

        card.classList.add("user-card-hover");

        card.addEventListener("click", () => {
            this.handleUserCardClick(user);
        });

        return card;
    }

    updateOnlineCount() {
        const onlineCount = Array.from(this.usersList.values()).filter(
            (user) => user.status === "online"
        ).length;
        this.onlineCountBadge.textContent = onlineCount;
    }

    clearOnlineUsers() {
        this.usersList.clear();
        this.onlineUsersContainer.innerHTML = "";
        this.updateOnlineCount();
    }

    handleUserCardClick(user) {
        console.log("User card clicked:", user);
    }

    getCurrentUserGame() {
        return this.currentUser?.currentGame || null;
    }

    isUserInGame(userId) {
        const user = this.usersList.get(userId);
        return user?.currentGame != null;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const style = document.createElement("style");
    style.textContent = `
        .user-card-hover {
            transition: all 0.2s ease-in-out;
            cursor: pointer;
        }
        .user-card-hover:hover {
            background-color: rgba(0, 0, 0, 0.05);
        }
        .online-users-list {
            scrollbar-width: thin;
            scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
        }
        .online-users-list::-webkit-scrollbar {
            width: 6px;
        }
        .online-users-list::-webkit-scrollbar-track {
            background: transparent;
        }
        .online-users-list::-webkit-scrollbar-thumb {
            background-color: rgba(0, 0, 0, 0.2);
            border-radius: 3px;
        }
    `;
    document.head.appendChild(style);

    window.onlineUsersManager = new OnlineUsersManager();
});
