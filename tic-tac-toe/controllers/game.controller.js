const Game = require("../models/game");

class GameController {
    static async showCreateForm(req, res) {
        try {
            const existingGame = await Game.findActiveGameByHostId(req.user.id);

            if (existingGame) {
                return res.redirect(`/game/${existingGame.id}`);
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
                    redirectUrl: `/game/${existingGame.id}`,
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
                redirectUrl: `/game/${game.id}`,
            });
        } catch (error) {
            console.error("Error creating game:", error);
            res.status(500).json({
                error: "Failed to create game",
            });
        }
    }

    static async getGameLobby(req, res) {
        try {
            const gameId = req.params.id;

            if (isNaN(parseInt(gameId))) {
                return res.redirect("/");
            }

            const game = await Game.getGameWithPlayers(gameId);

            if (!game) {
                return res.redirect("/");
            }

            res.render("lobby", {
                game,
                user: req.user,
                isHost: game.host_id === req.user.id,
                layout: "main",
            });
        } catch (error) {
            console.error("Error loading game lobby:", error);
            res.status(500).render("error", {
                message: "Error loading game lobby",
            });
        }
    }

    static async showCurrentGame(req, res) {
        try {
            const existingGame = await Game.findActiveGameByHostId(req.user.id);

            if (!existingGame) {
                return res.redirect("/");
            }

            res.redirect(`/game/${existingGame.id}`);
        } catch (error) {
            console.error("Error getting current game:", error);
            res.status(500).render("error", {
                message: "Failed to get current game",
            });
        }
    }
}

module.exports = GameController;
