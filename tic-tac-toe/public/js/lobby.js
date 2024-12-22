class LobbyManager {
    constructor() {
        this.socket = io();
        this.gameId = window.location.pathname.split("/").pop();
        this.isHost =
            document.querySelector(".game-header")?.dataset.isHost === "true";

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
            leaveButton.addEventListener("click", (e) => {
                e.preventDefault();
                this.showLeaveConfirmation();
            });
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
        });

        this.socket.on("lobby:join_rejected", () => {
            this.handleLeaveLobby();
        });

        this.socket.on("lobby:error", (error) => {
            if (error === "existing_game") {
                this.elements.existingGameModal.show();
            } else if (
                error.includes("already has two players") ||
                error.includes("no longer accepting")
            ) {
                this.handleLeaveLobby();
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
            if (this.elements.guestPlayer) {
                this.elements.guestPlayer.innerHTML = `
                    <div class="text-center text-muted">
                        <i class="bi bi-person-plus"></i>
                        Waiting for player...
                    </div>`;
                this.elements.guestPlayer.classList.add("bg-light");
            }
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

        window.addEventListener("beforeunload", (e) => {
            e.preventDefault();
            return "";
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
        const confirmationModalHtml = `
            <div class="modal fade" id="existingGameModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Existing Game Found</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <p>You already have an active game. If you join this game, your current game will be deleted and all players will be returned to the home page.</p>
                            <p>Do you want to continue?</p>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-danger" id="confirmJoinBtn">Yes, Join New Game</button>
                        </div>
                    </div>
                </div>
            </div>`;

        document.body.insertAdjacentHTML("beforeend", confirmationModalHtml);
        this.elements.existingGameModal = new bootstrap.Modal(
            document.getElementById("existingGameModal")
        );

        const confirmJoinBtn = document.getElementById("confirmJoinBtn");
        if (confirmJoinBtn) {
            confirmJoinBtn.addEventListener("click", () => {
                this.socket.emit("lobby:force_join_request", this.gameId);
                this.elements.existingGameModal.hide();
            });
        }

        if (this.isHost) {
            const modalHtml = `
            <div class="modal fade" id="joinRequestModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Join Request</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
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
});
