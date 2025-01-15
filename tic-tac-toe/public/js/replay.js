$(document).ready(function () {
    let currentMoveIndex = -1;
    let isPlaying = false;
    let replayInterval = null;
    let replaySpeed = parseInt($("#speedSelect").val());
    let board = [];

    const $boardContainer = $(".game-board-container");
    const boardSize = parseInt($boardContainer.data("boardSize"));
    const hostId = $boardContainer.data("hostId");
    const guestId = $boardContainer.data("guestId");

    // Initialize empty board
    for (let i = 0; i < boardSize; i++) {
        board[i] = Array(boardSize).fill(null);
    }

    let moves = [];
    try {
        const movesData = $boardContainer.data("moves");
        if (typeof movesData === "string") {
            moves = JSON.parse(movesData);
        } else if (Array.isArray(movesData)) {
            moves = movesData;
        }

        moves = moves
            .map((move, index) => ({
                ...move,
                moveNumber: index + 1,
            }))
            .filter((move) => {
                const x = parseInt(move.position_x);
                const y = parseInt(move.position_y);
                return (
                    !isNaN(x) &&
                    !isNaN(y) &&
                    x >= 0 &&
                    x < boardSize &&
                    y >= 0 &&
                    y < boardSize
                );
            });

        console.log("Processed moves:", moves);
    } catch (error) {
        console.error("Error processing moves:", error);
        moves = [];
    }

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

        // Remove highlighting from previous move if exists
        if (currentMoveIndex >= 0) {
            const prevMove = moves[currentMoveIndex];
            const $prevCell = $(
                `.replay-board-cell[data-row="${prevMove.position_x}"][data-col="${prevMove.position_y}"]`
            );
            $prevCell.removeClass("current-move-highlight");
        }

        currentMoveIndex++;
        const move = moves[currentMoveIndex];

        if (!move) {
            console.error("Invalid move at index:", currentMoveIndex);
            return;
        }

        const x = parseInt(move.position_x);
        const y = parseInt(move.position_y);
        const piece = parseInt(move.user_id) === parseInt(hostId) ? "X" : "O";

        if (
            !isNaN(x) &&
            !isNaN(y) &&
            x >= 0 &&
            x < boardSize &&
            y >= 0 &&
            y < boardSize
        ) {
            // Update board state
            board[x][y] = piece;

            // Update display and add highlight to current move
            const $cell = $(
                `.replay-board-cell[data-row="${x}"][data-col="${y}"]`
            );
            $cell.html(getPieceSVG(piece)).addClass("current-move-highlight");

            updateMoveHighlight();
            updateControlButtons();
        } else {
            console.error("Invalid move position:", move);
        }
    }

    function stepBack() {
        if (currentMoveIndex < 0) return;

        // Remove current move's piece and highlight
        const currentMove = moves[currentMoveIndex];
        if (currentMove) {
            const $currentCell = $(
                `.replay-board-cell[data-row="${currentMove.position_x}"][data-col="${currentMove.position_y}"]`
            );
            $currentCell.empty().removeClass("current-move-highlight");
            // Also clear it from the board array
            board[currentMove.position_x][currentMove.position_y] = null;
        }

        currentMoveIndex--;

        // Add highlight to previous move if there is one
        if (currentMoveIndex >= 0) {
            const prevMove = moves[currentMoveIndex];
            const $prevCell = $(
                `.replay-board-cell[data-row="${prevMove.position_x}"][data-col="${prevMove.position_y}"]`
            );
            $prevCell.addClass("current-move-highlight");
        }

        updateMoveHighlight();
        updateControlButtons();
    }

    function reconstructBoardToMove(moveIndex) {
        // Clear the board array and display
        for (let i = 0; i < boardSize; i++) {
            for (let j = 0; j < boardSize; j++) {
                board[i][j] = null;
                $(
                    `.replay-board-cell[data-row="${i}"][data-col="${j}"]`
                ).empty();
            }
        }

        // Replay moves up to the current index
        for (let i = 0; i <= moveIndex; i++) {
            const move = moves[i];
            const x = parseInt(move.position_x);
            const y = parseInt(move.position_y);
            const piece =
                parseInt(move.user_id) === parseInt(hostId) ? "X" : "O";

            board[x][y] = piece;
            const $cell = $(
                `.replay-board-cell[data-row="${x}"][data-col="${y}"]`
            );
            $cell.html(getPieceSVG(piece));
        }
    }

    function reset() {
        stopReplay();
        currentMoveIndex = -1;
        // Clear the board array and display
        for (let i = 0; i < boardSize; i++) {
            for (let j = 0; j < boardSize; j++) {
                board[i][j] = null;
                $(`.replay-board-cell[data-row="${i}"][data-col="${j}"]`)
                    .empty()
                    .removeClass("current-move-highlight");
            }
        }
        updateMoveHighlight();
        updateControlButtons();
    }

    function updateMoveHighlight() {
        $(".replay-move-item").removeClass("current-move");

        if (currentMoveIndex >= 0) {
            const $currentMove = $(
                `.replay-move-item[data-move-number="${currentMoveIndex + 1}"]`
            );
            $currentMove.addClass("current-move");

            const $movesList = $(".replay-moves-list");
            if ($movesList.length && $currentMove.length) {
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
        };
        return pieces[piece] || "";
    }

    $(document).on("visibilitychange", function () {
        if (document.hidden && isPlaying) {
            stopReplay();
        }
    });
});
