class LobbyManager {
    constructor() {
        this.socket = io();
        this.gameId = window.location.pathname.split("/").pop();
        this.isHost =
            document.querySelector(".game-header")?.dataset.isHost === "true";
        this.isSpectator =
            document.querySelector(".game-header")?.dataset.isSpectator ===
            "true";
        this.allowCustom = false;
        const gameEndModalEl = document.getElementById("gameEndModal");
        this.gameEndModal = new bootstrap.Modal(gameEndModalEl);

        gameEndModalEl.addEventListener("hidden.bs.modal", () => {
            window.location.href = "/";
        });

        document
            .getElementById("backToLobbyBtn")
            .addEventListener("click", () => {
                this.gameEndModal.hide();
            });

        this.spectatorsList = document.querySelector(".spectators-list");
        this.spectatorCount = document.querySelector(".spectator-count");
        this.elements = {
            guestPlayer: document.querySelector(".guest-player"),
            gameStatus: document.querySelector(".game-status"),
            playersSection: document.querySelector(".players-list"),
            joinRequestModal: null,
            leaveConfirmModal: null,
        };

        this.movesHistory = [];
        this.movesList = document.querySelector(".moves-timeline");
        this.noMovesMessage = document.getElementById("no-moves-message");

        this.initialize();
        this.setupJoinRequestModal();
        this.setupLeaveConfirmModal();
        this.initializeMovesHistory();
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

        this.socket.on("lobby:guest_left", (data) => {
            this.clearMovesHistory();
            window.location.reload();
        });

        this.socket.on("game:started", (data) => {
            this.handleGameStart(data);
        });

        this.socket.on("game:turn_change", (data) => {
            this.handleTurnChange(data);
        });

        this.socket.on("game:move_made", (data) => {
            this.boardState = data.gameState.board;
            this.updateBoardDisplay();
        });

        this.socket.on("game:turn_timer_start", (data) => {
            this.startTurnTimer(data.turnTimeLimit);
        });

        this.socket.on("game:ended", (data) => {
            this.handleGameEnd(data);
        });

        this.socket.on("game:state_sync", (data) => {
            this.handleGameStateSync(data);
        });

        this.socket.on("game:move_made", (data) => {
            this.handleMove(data);
        });

        this.socket.on("game:state_sync", (data) => {
            this.handleGameStateSync(data);
        });

        this.socket.on("game:started", (data) => {
            this.clearMovesHistory();
            this.updateMovesDisplay();
        });
    }

    initializeMovesHistory() {
        if (this.movesHistory.length > 0) {
            this.noMovesMessage.style.display = "none";
        }

        this.socket.emit("game:request_state", this.gameId);
    }

    handleMove(data) {
        const { move, gameState } = data;

        this.addMoveToHistory({
            moveNumber: this.movesHistory.length + 1,
            piece: move.piece,
            position: { row: move.row, col: move.col },
        });

        if (move && gameState) {
            this.boardState = gameState.board;
            this.updateBoardDisplay();
        }
    }

    addMoveToHistory(move) {
        this.movesHistory.push(move);
        this.updateMovesDisplay();
    }

    clearMovesHistory() {
        this.movesHistory = [];
        const movesList = document.querySelector(".moves-timeline");
        const noMovesMessage = document.getElementById("no-moves-message");

        if (movesList) {
            movesList.innerHTML = "";
        }

        if (noMovesMessage) {
            noMovesMessage.style.display = "block";
            noMovesMessage.textContent = "No moves have been made yet.";
        }
    }

    updateMovesDisplay() {
        if (!this.movesList) {
            console.error("Moves list element not found");
            return;
        }

        if (this.movesHistory.length === 0) {
            if (this.noMovesMessage) {
                this.noMovesMessage.style.display = "block";
            }
            this.movesList.innerHTML = "";
            return;
        }

        if (this.noMovesMessage) {
            this.noMovesMessage.style.display = "none";
        }

        const movesHTML = this.movesHistory
            .map((move, index) => {
                const isLatestMove = index === this.movesHistory.length - 1;
                return `
                <div class="move-item ${
                    isLatestMove ? "current-move" : ""
                }" data-move-number="${move.moveNumber}">
                    <span class="move-number">#${move.moveNumber}</span>
                    <div class="move-piece">
                        ${this.getPieceSVG(move.piece)}
                    </div>
                    <span class="move-position">
                        Row ${move.position.row + 1}, Col ${
                    move.position.col + 1
                }
                    </span>
                </div>
            `;
            })
            .join("");

        this.movesList.innerHTML = movesHTML;

        const movesListContainer = document.querySelector(".moves-list");
        if (movesListContainer) {
            movesListContainer.scrollTop = movesListContainer.scrollHeight;
        }
    }

    handleGameStateSync(data) {
        if (!data || !data.gameState) {
            console.error("Invalid game state data received");
            return;
        }

        this.clearMovesHistory();

        if (data.gameState.board) {
            let moveNumber = 1;
            data.gameState.board.forEach((row, rowIndex) => {
                row.forEach((piece, colIndex) => {
                    if (piece) {
                        this.addMoveToHistory({
                            moveNumber: moveNumber++,
                            piece: piece,
                            position: { row: rowIndex, col: colIndex },
                        });
                    }
                });
            });
        }

        this.boardState = data.gameState.board;
        this.currentTurn = data.currentTurn;
        this.hostPiece = data.hostGamePiece;
        this.guestPiece = data.guestGamePiece;

        this.updateBoardDisplay();
        this.updateMovesDisplay();

        this.addTurnIndicator(data.currentTurn);

        if (!document.querySelector(".turn-timer")) {
            this.addTimerDisplay();
        }

        const isMyTurn =
            this.currentTurn ===
            parseInt(document.getElementById("userId").innerHTML);
        this.enableBoardInteraction(isMyTurn);

        if (data.turnTimeLimit) {
            this.startTurnTimer(data.turnTimeLimit);
        }
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

    handleGameStart(data) {
        const startGameBtn = document.getElementById("startGameBtn");
        if (startGameBtn) {
            startGameBtn.remove();
        }

        const statusBadge = document.querySelector(".game-status .badge");
        if (statusBadge) {
            statusBadge.textContent = "In Progress";
            statusBadge.className = "badge bg-secondary";
        }

        this.boardState = data.gameState.board;
        this.currentTurn = data.currentTurn;
        this.hostPiece = data.hostGamePiece;
        this.guestPiece = data.guestGamePiece;
        this.allowCustom = data.gameState.allowCustomSettings;

        this.addTurnIndicator(data.currentTurn);

        this.addTimerDisplay();

        const isMyTurn =
            this.currentTurn ===
            parseInt(document.getElementById("userId").innerHTML);
        this.enableBoardInteraction(isMyTurn);

        this.startTurnTimer(data.turnTimeLimit);
    }

    addTurnIndicator(currentTurn) {
        const hostPlayer = document.querySelector(".host-player");
        const guestPlayer = document.querySelector(".guest-player");

        if (hostPlayer) {
            this.updatePlayerTurnStatus(hostPlayer, currentTurn);
        }

        if (guestPlayer) {
            this.updatePlayerTurnStatus(guestPlayer, currentTurn);
        }
    }

    updatePlayerTurnStatus(playerElement, currentTurn) {
        const isCurrentTurn =
            parseInt(playerElement.dataset.userid) === currentTurn;
        playerElement.classList.toggle("active-turn", isCurrentTurn);
    }

    addTimerDisplay() {
        const timerContainer = document.createElement("div");
        timerContainer.className = "turn-timer mt-3 text-center";
        timerContainer.innerHTML = '<span class="time-remaining"></span>';
        document.querySelector(".game-info").appendChild(timerContainer);
    }

    startTurnTimer(timeLimit) {
        if (this.turnTimer) {
            clearInterval(this.turnTimer);
        }

        const timerDisplay = document.querySelector(".time-remaining");
        if (!timerDisplay) return;

        let timeLeft = timeLimit;
        timerDisplay.textContent = `Time left: ${timeLeft}s`;

        this.turnTimer = setInterval(() => {
            timeLeft--;
            timerDisplay.textContent = `Time left: ${timeLeft}s`;

            if (timeLeft <= 0) {
                clearInterval(this.turnTimer);
                this.socket.emit("game:turn_expired", this.gameId);
            }
        }, 1000);
    }

    handleTurnChange(data) {
        this.currentTurn = data.currentTurn;

        const hostPlayer = document.querySelector(".host-player");
        const guestPlayer = document.querySelector(".guest-player");

        this.updatePlayerTurnStatus(hostPlayer, data.currentTurn);
        this.updatePlayerTurnStatus(guestPlayer, data.currentTurn);

        const isMyTurn =
            data.currentTurn ===
            parseInt(document.getElementById("userId").innerHTML);
        this.enableBoardInteraction(isMyTurn);

        if (data.reason === "timer_expired") {
            this.startTurnTimer(data.turnTimeLimit);
        }
    }

    handleCellClick(row, col) {
        if (!this.isMyTurn() || this.boardState[row][col] !== null) {
            return;
        }

        let currentPiece;
        if (this.isHost) {
            if (this.allowCustom) {
                currentPiece = this.hostPiece;
            } else {
                currentPiece = "X";
            }
        } else {
            if (this.allowCustom) {
                currentPiece = this.guestPiece;
            } else {
                currentPiece = "O";
            }
        }
        this.boardState[row][col] = currentPiece;

        this.socket.emit("game:make_move", {
            gameId: this.gameId,
            row: row,
            col: col,
            piece: currentPiece,
        });
    }

    handleGameEnd(data) {
        this.boardState = data.gameState.board;
        this.updateBoardDisplay();

        setTimeout(() => {
            this.enableBoardInteraction(false);

            if (this.turnTimer) {
                clearInterval(this.turnTimer);
                const timerDisplay = document.querySelector(".time-remaining");
                if (timerDisplay) {
                    timerDisplay.textContent = "Game Over";
                }
            }

            const titleElement = document.getElementById("gameEndTitle");
            const messageElement = document.getElementById("gameEndMessage");
            const ratingUpdateElement = document.getElementById("ratingUpdate");

            if (data.isDraw) {
                titleElement.textContent = "It's a Draw!";
                messageElement.textContent =
                    "The game ended in a draw. Both players played well!";
                ratingUpdateElement.textContent =
                    "No rating changes for a draw.";
            } else {
                const winner = data.winnerName;
                titleElement.textContent = `${winner} Wins!`;
                messageElement.textContent = `Congratulations to ${winner} for winning the game!`;
                ratingUpdateElement.innerHTML =
                    "Rating Update:<br>" +
                    `Winner: +10 points<br>` +
                    `Loser: -10 points`;
            }

            this.gameEndModal.show();

            const statusBadge = document.querySelector(".game-status .badge");
            if (statusBadge) {
                statusBadge.textContent = data.isDraw ? "Draw" : "Game Over";
                statusBadge.className = "badge bg-secondary";
            }
        }, 500);
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
                    cellElement.innerHTML = cell ? this.getPieceSVG(cell) : "";
                }
            });
        });
    }

    isMyTurn() {
        return (
            this.currentTurn ===
            parseInt(document.getElementById("userId").innerHTML)
        );
    }

    enableBoardInteraction(enabled) {
        const cells = document.querySelectorAll(".board-cell");
        cells.forEach((cell) => {
            cell.style.cursor = enabled ? "pointer" : "not-allowed";
            cell.classList.toggle("disabled", !enabled);
        });
    }

    handleBoardColors() {
        const gameBoard = document.querySelector(".game-board");
        if (!gameBoard) return;

        let hostColor;
        let guestColor;

        this.allowCustom = gameBoard.dataset.allowCustom;
        if (gameBoard.dataset.allowCustom) {
            hostColor = gameBoard.dataset.hostColor;
            guestColor = gameBoard.dataset.guestColor;
        } else {
            hostColor = "#f0f0f0";
            guestColor = "#838383";
        }

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
            if (game.status === "ready") {
                statusBadge.textContent = "Ready to Start";
                statusBadge.classList.remove("bg-warning");
                statusBadge.classList.remove("bg-secondary");
                statusBadge.classList.add("bg-success");
            } else if (game.status === "in_progress") {
                statusBadge.textContent = "In Progress";
                statusBadge.classList.remove("bg-warning");
                statusBadge.classList.remove("bg-success");
                statusBadge.classList.add("bg-secondary");
            } else {
                statusBadge.textContent = "Waiting for Players";
                statusBadge.classList.remove("bg-success");
                statusBadge.classList.remove("bg-secondary");
                statusBadge.classList.add("bg-warning");
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

    getPieceSVG(piece) {
        const pieces = {
            X: `
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            `,
            O: `
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <circle cx="12" cy="12" r="10"></circle>
                </svg>
            `,
            club: `<svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="lucide lucide-club"
                >
                    <path
                        d="M17.28 9.05a5.5 5.5 0 1 0-10.56 0A5.5 5.5 0 1 0 12 17.66a5.5 5.5 0 1 0 5.28-8.6Z"
                    />
                    <path d="M12 17.66L12 22" />
                </svg>`,
            spade: `
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="lucide lucide-spade"
                >
                    <path
                        d="M5 9c-1.5 1.5-3 3.2-3 5.5A5.5 5.5 0 0 0 7.5 20c1.8 0 3-.5 4.5-2 1.5 1.5 2.7 2 4.5 2a5.5 5.5 0 0 0 5.5-5.5c0-2.3-1.5-4-3-5.5l-7-7-7 7Z"
                    />
                    <path d="M12 18v4" />
                </svg>`,
            heart: `
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="lucide lucide-heart"
                >
                    <path
                        d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
                    />
                </svg>
                `,
            diamond: `
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="lucide lucide-diamond"
                >
                    <path
                        d="M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41l-7.59-7.59a2.41 2.41 0 0 0-3.41 0Z"
                    />
                </svg>    
            `,
        };
        return pieces[piece] || "";
    }
}

document.addEventListener("DOMContentLoaded", () => {
    window.lobbyManager = new LobbyManager();
    window.lobbyManager.initializeGameBoard();
    window.lobbyManager.handleBoardColors();
    window.lobbyManager.updateLobbyState();
});
