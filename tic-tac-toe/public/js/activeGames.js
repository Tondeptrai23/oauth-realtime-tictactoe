class GamesManager {
    constructor() {
        this.socket = io();
        this.gamesGrid = document.getElementById("gamesGrid");
        this.gameCardTemplate = document.getElementById("gameCardTemplate");
        this.userId = parseInt(document.getElementById("userId").innerHTML);
        this.DIALOG_TIMEOUT = 30000;

        this.initialize();
    }

    initialize() {
        this.socket.emit("games:request");

        this.socket.on("games:list", (games) => {
            this.renderGames(games);
        });

        this.socket.on("game:created", () => {
            this.socket.emit("games:request");
        });

        this.socket.on("lobby:join_rejected", (data) => {
            if (data.userId === this.userId) {
                this.hideWaitingDialog();
                alert("Host rejected your join request");
            }
        });

        this.socket.on("lobby:join_approved", (data) => {
            if (data.userId === this.userId) {
                this.hideWaitingDialog();
                window.location.href = `/game/${data.gameId}`;
            }
        });

        this.socket.on("lobby:player_joined", (data) => {
            this.hideWaitingDialog();
            this.socket.emit("games:request");
        });
    }

    showWaitingDialog() {
        if (!this.waitingDialog) {
            const template = document.getElementById("waitingDialogTemplate");
            document.body.appendChild(template.content.cloneNode(true));
            this.waitingDialog = new bootstrap.Modal(
                document.getElementById("waitingDialog"),
                {
                    keyboard: false,
                }
            );
        }
        this.waitingDialog.show();

        this.waitingDialogTimer = setTimeout(() => {
            this.hideWaitingDialog();
            alert("Request timed out. Please try again.");
        }, this.DIALOG_TIMEOUT);
    }

    hideWaitingDialog() {
        if (this.waitingDialogTimer) {
            clearTimeout(this.waitingDialogTimer);
            this.waitingDialogTimer = null;
        }

        if (this.waitingDialog) {
            this.waitingDialog.hide();
            document.getElementById("waitingDialog").remove();
            this.waitingDialog = null;
        }
    }

    renderGames(games) {
        if (!this.gamesGrid || !this.gameCardTemplate) {
            console.error("Required DOM elements not found");
            return;
        }

        this.gamesGrid.innerHTML = "";

        if (games.length === 0) {
            const noGamesMessage = document.createElement("div");
            noGamesMessage.className = "col-12 text-center text-muted";
            noGamesMessage.textContent = "No active games. Create one!";
            this.gamesGrid.appendChild(noGamesMessage);
            return;
        }

        games.forEach((game) => {
            const gameCard = this.createGameCard(game);
            this.gamesGrid.appendChild(gameCard);
        });
    }

    createGameCard(game) {
        const template = this.gameCardTemplate.content.cloneNode(true);
        const card = template.querySelector(".card");

        const hostElement = card.querySelector(".game-host");
        hostElement.textContent = game.host_username;

        card.querySelector(
            ".board-size"
        ).textContent = `${game.board_size}x${game.board_size}`;

        const timeLimit = card.querySelector(".time-limit");
        if (timeLimit) {
            timeLimit.textContent = `${game.turn_time_limit}s per turn`;
        }

        const customSettings = card.querySelector(".custom-settings");
        if (customSettings) {
            customSettings.textContent = game.allow_custom_settings
                ? "Custom pieces allowed"
                : "Default pieces only";
            customSettings.classList.add(
                game.allow_custom_settings ? "text-success" : "text-secondary"
            );
        }

        const statusBadge = card.querySelector(".game-status");
        switch (game.status) {
            case "in_progress":
                statusBadge.textContent = "In Progress";
                statusBadge.classList.add("bg-primary");
                break;
            case "ready":
                statusBadge.textContent = "Ready";
                statusBadge.classList.add("bg-warning");
                break;
            default:
            case "waiting":
                statusBadge.textContent = "Waiting";
                statusBadge.classList.add("bg-success");
                break;
        }

        const joinButton = card.querySelector(".join-game-btn");
        if (game.status === "waiting") {
            joinButton.textContent = "Join Game";
            joinButton.classList.add("btn-primary");
            joinButton.addEventListener("click", () => {
                this.showWaitingDialog();
                this.socket.emit("lobby:join_request", game.id);
            });
        } else {
            joinButton.textContent = "Spectate";
            joinButton.classList.add("btn-secondary");
            joinButton.addEventListener("click", () => {
                window.location.href = `/game/${game.id}?mode=spectate`;
            });
        }

        joinButton.addEventListener("click", () => {
            this.showWaitingDialog();
            this.socket.emit("lobby:join_request", game.id);
        });

        return template;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    window.gamesManager = new GamesManager();
});
