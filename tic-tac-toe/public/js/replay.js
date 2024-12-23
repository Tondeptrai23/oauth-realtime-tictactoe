$(document).ready(function () {
    let currentMoveIndex = -1;
    let isPlaying = false;
    let replayInterval = null;
    let replaySpeed = parseInt($("#speedSelect").val());

    const $boardContainer = $(".game-board-container");
    const boardSize = parseInt($boardContainer.data("boardSize"));
    const hostId = $boardContainer.data("hostId");
    const guestId = $boardContainer.data("guestId");

    let board = Array(boardSize)
        .fill(null)
        .map(() => Array(boardSize).fill(null));

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
            board[x][y] = piece;
            updateBoardDisplay();
            updateMoveHighlight();
            updateControlButtons();
        } else {
            console.error("Invalid move position:", move);
        }
    }

    function stepBack() {
        if (currentMoveIndex < 0) return;

        const move = moves[currentMoveIndex];
        if (move) {
            const x = parseInt(move.position_x);
            const y = parseInt(move.position_y);
            if (
                !isNaN(x) &&
                !isNaN(y) &&
                x >= 0 &&
                x < boardSize &&
                y >= 0 &&
                y < boardSize
            ) {
                board[x][y] = null;
            }
        }

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
        $(".replay-board-cell").each(function () {
            const $cell = $(this);
            const row = parseInt($cell.data("row"));
            const col = parseInt($cell.data("col"));
            if (!isNaN(row) && !isNaN(col) && board[row] && board[row][col]) {
                $cell.html(getPieceSVG(board[row][col]));
            } else {
                $cell.empty();
            }
        });
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
