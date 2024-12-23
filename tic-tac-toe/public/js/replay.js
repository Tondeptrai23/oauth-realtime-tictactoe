$(document).ready(function () {
    // State variables
    let currentMoveIndex = -1;
    let isPlaying = false;
    let replayInterval = null;
    let replaySpeed = parseInt($("#speedSelect").val());

    // Initialize board state
    const $boardContainer = $(".game-board-container");
    const boardSize = parseInt($boardContainer.data("boardSize"));
    // Get moves data
    let moves = [];
    const movesData = $boardContainer.data("moves");

    if (typeof movesData === "string") {
        try {
            moves = JSON.parse(movesData);
        } catch (error) {
            console.error("Error parsing moves:", error);
        }
    } else if (Array.isArray(movesData)) {
        moves = movesData;
    }

    // Ensure moves is an array
    if (!Array.isArray(moves)) {
        moves = [];
        console.error("Invalid moves data");
    }
    const hostId = $boardContainer.data("hostId");
    const guestId = $boardContainer.data("guestId");

    let board = Array(boardSize)
        .fill(null)
        .map(() => Array(boardSize).fill(null));

    // Event handlers
    $("#playPauseBtn").on("click", togglePlayPause);
    $("#stepBackBtn").on("click", stepBack);
    $("#stepForwardBtn").on("click", stepForward);
    $("#resetBtn").on("click", reset);
    $("#speedSelect").on("change", function () {
        replaySpeed = parseInt($(this).val());
        if (isPlaying) {
            stopReplay();
            startReplay();
        }
    });

    // Initialize control buttons state
    updateControlButtons();

    function togglePlayPause() {
        if (isPlaying) {
            stopReplay();
        } else {
            startReplay();
        }
    }

    function startReplay() {
        if (currentMoveIndex >= moves.length - 1) {
            reset();
        }

        isPlaying = true;
        updatePlayPauseButton();

        replayInterval = setInterval(() => {
            if (currentMoveIndex >= moves.length - 1) {
                stopReplay();
                return;
            }
            stepForward();
        }, replaySpeed);
    }

    function stopReplay() {
        isPlaying = false;
        updatePlayPauseButton();
        if (replayInterval) {
            clearInterval(replayInterval);
            replayInterval = null;
        }
    }

    function stepForward() {
        if (currentMoveIndex >= moves.length - 1) return;

        currentMoveIndex++;
        const move = moves[currentMoveIndex];

        // Update board state
        const piece = parseInt(move.user_id) === parseInt(hostId) ? "X" : "O";
        board[move.position_x][move.position_y] = piece;

        updateBoardDisplay();
        updateMoveHighlight();
        updateControlButtons();
    }

    function stepBack() {
        if (currentMoveIndex < 0) return;

        // Clear current position
        const move = moves[currentMoveIndex];
        board[move.position_x][move.position_y] = null;

        currentMoveIndex--;
        updateBoardDisplay();
        updateMoveHighlight();
        updateControlButtons();
    }

    function reset() {
        stopReplay();
        currentMoveIndex = -1;
        board = Array(boardSize)
            .fill(null)
            .map(() => Array(boardSize).fill(null));
        updateBoardDisplay();
        updateMoveHighlight();
        updateControlButtons();
    }

    function updateBoardDisplay() {
        $(".board-cell").each(function () {
            const $cell = $(this);
            const row = parseInt($cell.data("row"));
            const col = parseInt($cell.data("col"));
            $cell.html(getPieceSVG(board[row][col]));
        });
    }

    function updateMoveHighlight() {
        $(".move-item").removeClass("current-move");

        if (currentMoveIndex >= 0) {
            const $currentMove = $(
                `.move-item[data-move-number="${currentMoveIndex + 1}"]`
            );
            $currentMove.addClass("current-move");

            // Scroll to current move
            const $movesList = $(".moves-list");
            const moveTop = $currentMove.position().top;
            const movesListHeight = $movesList.height();
            const scrollPosition = moveTop - movesListHeight / 2;

            $movesList.animate(
                {
                    scrollTop: scrollPosition + $movesList.scrollTop(),
                },
                300
            );
        }
    }

    function updateControlButtons() {
        $("#stepBackBtn").prop("disabled", currentMoveIndex < 0);
        $("#stepForwardBtn").prop(
            "disabled",
            currentMoveIndex >= moves.length - 1
        );
    }

    function updatePlayPauseButton() {
        const $icon = $("#playPauseBtn i");
        $icon
            .removeClass("bi-play bi-pause")
            .addClass(isPlaying ? "bi-pause" : "bi-play");
    }

    function getPieceSVG(piece) {
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

    $(document).on("visibilitychange", function () {
        if (document.hidden && isPlaying) {
            stopReplay();
        }
    });
});
