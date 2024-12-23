const UserModel = require("../models/user");
const axios = require("axios");
const https = require("https");
const path = require("path");
const fs = require("fs");
const {
    STATIC_AVATARS,
    GAME_PIECES,
    BOARD_COLORS,
} = require("../config/assets");

class ProfileController {
    static async getProfile(req, res) {
        try {
            const user = await UserModel.findById(req.user.id);

            const useAuthAvatar = req.user.scope?.includes("profile:full");

            res.render("profile", {
                user,
                staticAvatars: STATIC_AVATARS,
                gamePieces: GAME_PIECES,
                boardColors: BOARD_COLORS,
                useAuthAvatar,
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
            const { avatar_url, game_piece, board_color, nickname } = req.body;

            if (!this.validateProfileUpdate(req.body, req.user.scope)) {
                return res
                    .status(400)
                    .json({ error: "Invalid input parameters" });
            }

            const updatedUser = await UserModel.updateProfile(
                req.user.id,
                {
                    avatar_url,
                    game_piece,
                    board_color,
                    nickname,
                },
                req
            );

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

    static async getProfilePicture(req, res) {
        try {
            const avatar_url = await UserModel.getProfilePicture(req.user.id);

            if (avatar_url === "auth") {
                const user = await UserModel.findById(req.user.id);

                if (user.avatar) {
                    res.setHeader("Content-Type", "image/png");
                    return res.send(user.avatar);
                }
            }

            res.setHeader("Content-Type", "image/png");
            return res.send(
                fs.readFileSync(
                    path.join(__dirname, "../", "public", avatar_url)
                )
            );
        } catch (error) {
            console.error("Error fetching profile data:", error);
        }
    }

    static async getProfilePictureFromAuth(req, res) {
        try {
            const axiosInstance = axios.create({
                httpsAgent: new https.Agent({
                    rejectUnauthorized: false,
                }),
            });

            const response = await axiosInstance.get(
                process.env.AUTH_SERVER_PROFILE_AVATAR_URL,
                {
                    headers: {
                        Authorization: `Bearer ${req.user.accessToken}`,
                    },
                    responseType: "arraybuffer",
                }
            );

            res.set("Content-Type", "image/jpeg");
            res.send(response.data);
        } catch (error) {
            console.error("Error fetching profile data:", error);
        }
    }

    static async getProfilePictureById(req, res) {
        try {
            const avatar_url = await UserModel.getProfilePicture(
                req.params.userId
            );

            if (avatar_url === "auth") {
                const user = await UserModel.findById(req.params.userId);

                if (user.avatar) {
                    res.setHeader("Content-Type", "image/png");
                    return res.send(user.avatar);
                }
            }

            res.setHeader("Content-Type", "image/png");
            return res.send(fs.readFileSync(`${avatar_url}`));
        } catch (error) {
            console.error("Error fetching profile data:", error);
        }
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
