class LobbyManager {
    constructor() {
        this.socket = io();
        this.gameId = window.location.pathname.split("/").pop();
        this.isHost =
            document.querySelector(".game-header")?.dataset.isHost === "true";
        this.isSpectator =
            document.querySelector(".game-header")?.dataset.isSpectator ===
            "true";

        this.spectatorsList = document.querySelector(".spectators-list");
        this.spectatorCount = document.querySelector(".spectator-count");
        this.elements = {
            guestPlayer: document.querySelector(".guest-player"),
            gameStatus: document.querySelector(".game-status"),
            playersSection: document.querySelector(".players-list"),
            joinRequestModal: null,
            leaveConfirmModal: null,
        };

        this.initialize();
        this.setupJoinRequestModal();
        this.setupLeaveConfirmModal();
        this.setupNavigationLock();
    }

    initialize() {
        this.socket.on("connect", () => {
            this.socket.emit("lobby:join", this.gameId);
        });

        const leaveButton = document.getElementById("leaveGameBtn");
        if (leaveButton) {
            if (this.isSpectator) {
                leaveButton.addEventListener("click", (e) => {
                    e.preventDefault();
                    this.socket.emit("lobby:spectator_leave", this.gameId);

                    window.location.href = "/";
                });
            } else {
                leaveButton.addEventListener("click", (e) => {
                    e.preventDefault();
                    this.showLeaveConfirmation();
                });
            }
        }

        if (!this.isHost) {
            this.requestToJoin();
        }

        if (this.isHost) {
            this.socket.on("lobby:join_request", (userData) => {
                this.showJoinRequest(userData);
            });
        }

        this.socket.on("lobby:player_joined", (data) => {
            this.updateGuestPlayer(data.guest);

            window.location.reload();
            window.onload = () => this.handleBoardColors();
        });

        this.socket.on("lobby:error", (error) => {
            if (error === "existing_game") {
                this.elements.existingGameModal.show();
            }
        });

        this.socket.on("lobby:state", (state) => {
            this.updateLobbyState(state);
        });

        this.socket.on("lobby:game_deleted", () => {
            window.location.href = "/";
        });

        this.socket.on("lobby:redirect_home", () => {
            window.location.href = "/";
        });

        this.socket.on("lobby:guest_left", () => {
            window.location.reload();
        });

        this.socket.on("game:started", () => {
            const startGameBtn = document.getElementById("startGameBtn");
            if (startGameBtn) {
                startGameBtn.remove();
            }
        });
    }

    initializeGameBoard() {
        const gameBoard = document.querySelector(".game-board");
        if (!gameBoard) return;

        const startGameBtn = document.getElementById("startGameBtn");
        if (startGameBtn) {
            startGameBtn.addEventListener("click", () => {
                if (this.isHost) {
                    this.socket.emit("game:start", this.gameId);
                }
            });
        }

        this.boardState = Array(parseInt(gameBoard.dataset.boardSize))
            .fill(null)
            .map(() => Array(parseInt(gameBoard.dataset.boardSize)).fill(null));

        const cells = gameBoard.querySelectorAll(".board-cell");
        cells.forEach((cell) => {
            cell.addEventListener("click", (e) => {
                const row = parseInt(cell.dataset.row);
                const col = parseInt(cell.dataset.col);
                this.handleCellClick(row, col);
            });
        });
    }

    handleCellClick(row, col) {
        console.log(`Cell clicked: ${row}, ${col}`);
    }

    updateBoardDisplay() {
        const gameBoard = document.querySelector(".game-board");
        if (!gameBoard) return;

        this.boardState.forEach((row, rowIndex) => {
            row.forEach((cell, colIndex) => {
                const cellElement = gameBoard.querySelector(
                    `.board-cell[data-row="${rowIndex}"][data-col="${colIndex}"]`
                );
                if (cellElement) {
                    cellElement.innerHTML = "";

                    if (cell) {
                        cellElement.innerHTML = GAME_PIECES[cell].svg;
                    }
                }
            });
        });
    }

    handleBoardColors() {
        const gameBoard = document.querySelector(".game-board");
        if (!gameBoard) return;

        const hostColor = gameBoard.dataset.hostColor;
        const guestColor = gameBoard.dataset.guestColor;

        const cells = gameBoard.querySelectorAll(".board-cell");
        cells.forEach((cell) => {
            const row = parseInt(cell.dataset.row);
            const col = parseInt(cell.dataset.col);
            cell.style.backgroundColor =
                (row + col) % 2 === 0 ? hostColor : guestColor;
        });
    }

    setupLeaveConfirmModal() {
        const modalHtml = `
            <div class="modal fade" id="leaveConfirmModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Leave Game?</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            ${
                                this.isHost
                                    ? "If you leave, the game will be deleted and all players will be returned to the homepage."
                                    : "Are you sure you want to leave the game?"
                            }
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Stay</button>
                            <button type="button" class="btn btn-danger" id="confirmLeaveBtn">Leave Game</button>
                        </div>
                    </div>
                </div>
            </div>`;

        document.body.insertAdjacentHTML("beforeend", modalHtml);
        this.elements.leaveConfirmModal = new bootstrap.Modal(
            document.getElementById("leaveConfirmModal")
        );

        const confirmLeaveBtn = document.getElementById("confirmLeaveBtn");
        if (confirmLeaveBtn) {
            confirmLeaveBtn.addEventListener("click", () => {
                this.elements.leaveConfirmModal.hide();
                if (this.isHost) {
                    this.socket.emit("lobby:host_leave", this.gameId);
                } else {
                    this.socket.emit("lobby:guest_leave", this.gameId);
                }
            });
        }
    }

    setupNavigationLock() {
        window.addEventListener("popstate", (e) => {
            e.preventDefault();
            this.showLeaveConfirmation();
            history.pushState(null, "", window.location.href);
        });

        history.pushState(null, "", window.location.href);

        document.addEventListener("click", (e) => {
            const link = e.target.closest("a");
            if (link && !link.hasAttribute("data-bs-dismiss")) {
                e.preventDefault();
                this.showLeaveConfirmation();
            }
        });
    }

    showLeaveConfirmation() {
        this.elements.leaveConfirmModal.show();
    }

    updateLobbyState(state) {
        const { game } = state;

        if (this.elements.gameStatus) {
            const statusBadge =
                this.elements.gameStatus.querySelector(".badge");
            if (game.guest_id) {
                statusBadge.textContent = "Ready to Start";
                statusBadge.classList.remove("bg-warning");
                statusBadge.classList.add("bg-success");
            }
        }

        if (game.guest_id && this.elements.guestPlayer) {
            this.updateGuestPlayer({
                id: game.guest_id,
                username: game.guest_username,
                avatarUrl: game.guest_avatar_url,
                rating: game.guest_rating,
            });
        }
    }

    setupJoinRequestModal() {
        if (this.isHost) {
            const modalHtml = `
            <div class="modal fade" id="joinRequestModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Join Request</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" id="closeJoinButton"></button>
                        </div>
                        <div class="modal-body">
                            <div class="d-flex align-items-center mb-3">
                                <img src="" alt="Player Avatar" class="avatar rounded-circle me-2" style="width: 48px; height: 48px;">
                                <div>
                                    <div class="fw-bold username"></div>
                                    <div class="text-muted rating"></div>
                                </div>
                            </div>
                            <p>This player would like to join your game.</p>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Reject</button>
                            <button type="button" class="btn btn-primary" id="approveJoinBtn">Approve</button>
                        </div>
                    </div>
                </div>
            </div>`;

            document.body.insertAdjacentHTML("beforeend", modalHtml);
            this.elements.joinRequestModal = new bootstrap.Modal(
                document.getElementById("joinRequestModal")
            );
        }
    }

    requestToJoin() {
        this.socket.emit("lobby:join_request", this.gameId);
    }

    showJoinRequest(userData) {
        const modal = document.getElementById("joinRequestModal");
        if (!modal) return;

        const avatar = modal.querySelector(".avatar");
        avatar.src =
            userData.avatarUrl === "auth"
                ? `/api/profile/avatar/${userData.userId}`
                : userData.avatarUrl;

        modal.querySelector(".username").textContent = userData.username;
        modal.querySelector(
            ".rating"
        ).textContent = `Rating: ${userData.rating}`;

        const approveBtn = modal.querySelector("#approveJoinBtn");
        approveBtn.onclick = () => {
            this.socket.emit("lobby:approve_join", {
                gameId: this.gameId,
                userId: userData.userId,
            });
            this.elements.joinRequestModal.hide();
        };

        modal.querySelector(".btn-secondary").onclick = () => {
            this.socket.emit("lobby:reject_join", {
                gameId: this.gameId,
                userId: userData.userId,
            });
            this.elements.joinRequestModal.hide();
        };

        modal.querySelector("#closeJoinButton").onclick = () => {
            this.socket.emit("lobby:reject_join", {
                gameId: this.gameId,
                userId: userData.userId,
            });
            this.elements.joinRequestModal.hide();
        };

        this.elements.joinRequestModal.show();
    }

    updateGuestPlayer(guest) {
        if (!this.elements.guestPlayer) return;

        this.elements.guestPlayer.innerHTML = `
            <div class="d-flex align-items-center">
                <img src="${
                    guest.avatarUrl === "auth"
                        ? `/api/profile/avatar/${guest.id}`
                        : guest.avatarUrl
                }"
                     alt="Guest Avatar"
                     class="avatar rounded-circle me-2"
                     style="width: 40px; height: 40px;">
                <div>
                    <div class="fw-bold">${guest.username}</div>
                    <small class="text-muted">Rating: ${guest.rating}</small>
                </div>
            </div>`;

        this.elements.guestPlayer.classList.remove("bg-light");
    }

    updateLobbyState(state) {
        const { game } = state;

        if (this.elements.gameStatus) {
            const statusBadge =
                this.elements.gameStatus.querySelector(".badge");
            if (game.guest_id) {
                statusBadge.textContent = "Ready to Start";
                statusBadge.classList.remove("bg-warning");
                statusBadge.classList.add("bg-success");
            }
        }

        if (game.guest_id && this.elements.guestPlayer) {
            this.updateGuestPlayer({
                id: game.guest_id,
                username: game.guest_username,
                avatarUrl: game.guest_avatar_url,
                rating: game.guest_rating,
            });
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    window.lobbyManager = new LobbyManager();
    window.lobbyManager.initializeGameBoard();
    window.lobbyManager.handleBoardColors();
});
