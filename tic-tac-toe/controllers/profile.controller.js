const UserModel = require("../models/user");

const STATIC_AVATARS = [
    "/images/avt1.png",
    "/images/avt2.png",
    "/images/avt3.png",
    "/images/avt4.png",
    "/images/avt5.png",
];

const GAME_PIECES = {
    X: {
        id: "X",
        svg: `
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
                    class="lucide lucide-x"
                >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                </svg>
            `,
    },
    O: {
        id: "O",
        svg: `
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
                    class="lucide lucide-circle"
                >
                    <circle cx="12" cy="12" r="10" />
                </svg>
            `,
    },
    heart: {
        id: "heart",
        svg: `
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
    },
    spade: {
        id: "spade",
        svg: `
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
                </svg>
            `,
    },
    club: {
        id: "club",
        svg: `
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
                    class="lucide lucide-club"
                >
                    <path
                        d="M17.28 9.05a5.5 5.5 0 1 0-10.56 0A5.5 5.5 0 1 0 12 17.66a5.5 5.5 0 1 0 5.28-8.6Z"
                    />
                    <path d="M12 17.66L12 22" />
                </svg>
            `,
    },
    diamond: {
        id: "diamond",
        svg: `
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
    },
};

const BOARD_COLORS = ["#ffffff", "#f0f0f0", "#e0e0e0", "#d0d0d0"];

class ProfileController {
    static async getProfile(req, res) {
        try {
            const user = await UserModel.findById(req.user.id);

            res.render("profile", {
                user,
                staticAvatars: STATIC_AVATARS,
                gamePieces: GAME_PIECES,
                boardColors: BOARD_COLORS,
                useAuthAvatar: req.user.scope?.includes("profile:full"),
            });
        } catch (error) {
            console.error("Profile page error:", error);
            res.status(500).render("error", {
                message: "Error loading profile",
            });
        }
    }

    static async updateProfile(req, res) {
        try {
            const { avatar_url, game_piece, board_color } = req.body;

            if (!this.validateProfileUpdate(req.body, req.user.scope)) {
                return res
                    .status(400)
                    .json({ error: "Invalid input parameters" });
            }

            const updatedUser = await UserModel.updateProfile(req.user.id, {
                avatar_url,
                game_piece,
                board_color,
            });

            res.json({ success: true, user: updatedUser });
        } catch (error) {
            console.error("Profile update error:", error);
            res.status(500).json({ error: "Error updating profile" });
        }
    }

    static validateProfileUpdate(updates, userScope) {
        const { game_piece, board_color, avatar_url } = updates;

        if (game_piece && !Object.keys(GAME_PIECES).includes(game_piece)) {
            return false;
        }

        if (board_color && !BOARD_COLORS.includes(board_color)) {
            return false;
        }

        if (
            avatar_url &&
            !STATIC_AVATARS.includes(avatar_url) &&
            !userScope?.includes("profile:full")
        ) {
            return false;
        }

        return true;
    }

    static getStaticData() {
        return {
            STATIC_AVATARS,
            GAME_PIECES: Object.keys(GAME_PIECES),
            BOARD_COLORS,
        };
    }
}

module.exports = ProfileController;