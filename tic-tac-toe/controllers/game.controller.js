const Game = require("../models/game");

class GameController {
    static async showCreateForm(req, res) {
        try {
            const existingGame = await Game.findActiveGameByHostId(req.user.id);

            if (existingGame) {
                return res.redirect(`/lobby/game/${existingGame.id}`);
            }

            res.render("create-game", {
                user: req.user,
                isLobby: true,
                hasCustomSettings:
                    req.user.game_piece !== "X" ||
                    req.user.board_color !== "#ffffff",
            });
        } catch (error) {
            console.error("Error checking existing game:", error);
            res.status(500).render("error", {
                message: "Error accessing game creation",
            });
        }
    }

    static async createGame(req, res) {
        try {
            const existingGame = await Game.findActiveGameByHostId(req.user.id);

            if (existingGame) {
                return res.status(400).json({
                    error: "You already have an active game",
                    redirectUrl: `/lobby/game/${existingGame.id}`,
                });
            }

            const { boardSize, turnTimeLimit, allowCustomSettings } = req.body;

            if (!Game.validateBoardSize(boardSize)) {
                return res.status(400).json({
                    error: "Invalid board size",
                });
            }

            if (!Game.validateTurnTimeLimit(turnTimeLimit)) {
                return res.status(400).json({
                    error: "Turn time limit must be between 10 and 120 seconds",
                });
            }

            const game = await Game.create(req.user.id, {
                boardSize,
                turnTimeLimit,
                allowCustomSettings: allowCustomSettings === "true",
            });

            req.app.get("io").emit("game:created", game);

            res.json({
                success: true,
                redirectUrl: `/lobby/game/${game.id}`,
            });
        } catch (error) {
            console.error("Error creating game:", error);
            res.status(500).json({
                error: "Failed to create game",
            });
        }
    }
}

module.exports = GameController;
