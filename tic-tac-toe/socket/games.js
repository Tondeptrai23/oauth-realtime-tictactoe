const db = require("../config/database");

class GamesManager {
    constructor(io, onlineUsersManager) {
        this.io = io;
        this.onlineUsersManager = onlineUsersManager;
    }

    initialize() {
        this.io.on("connection", (socket) => {
            this.sendActiveGames(socket);

            socket.on("games:request", () => {
                this.sendActiveGames(socket);
            });
        });
    }

    async sendActiveGames(socket) {
        try {
            const games = await db.manyOrNone(
                `SELECT g.*,
                        host.username as host_username,
                        host.avatar_url as host_avatar_url,
                        host.game_piece as host_piece,
                        COALESCE(
                            (SELECT COUNT(*) 
                             FROM ttt_users u 
                             WHERE u.id = ANY(
                                 SELECT DISTINCT user_id 
                                 FROM ttt_chat_messages 
                                 WHERE game_id = g.id
                             )
                            ), 
                            0
                        ) as spectator_count
                 FROM ttt_games g
                 JOIN ttt_users host ON g.host_id = host.id
                 WHERE g.status IN ('waiting', 'in_progress')
                 ORDER BY g.created_at DESC`
            );

            socket.emit("games:list", games);
        } catch (error) {
            console.error("Error fetching games:", error);
        }
    }

    async broadcastGamesList() {
        try {
            const games = await db.manyOrNone(
                `SELECT g.*, 
                        host.username as host_username,
                        host.avatar_url as host_avatar_url,
                        COALESCE(
                            (SELECT COUNT(*) 
                             FROM ttt_users u 
                             WHERE u.id = ANY(
                                 SELECT DISTINCT user_id 
                                 FROM ttt_chat_messages 
                                 WHERE game_id = g.id
                             )
                            ), 
                            0
                        ) as spectator_count
                 FROM ttt_games g
                 JOIN ttt_users host ON g.host_id = host.id
                 WHERE g.status IN ('waiting', 'in_progress')
                 ORDER BY g.created_at DESC`
            );

            this.io.emit("games:list", games);
        } catch (error) {
            console.error("Error broadcasting games:", error);
        }
    }
}

module.exports = { GamesManager };
