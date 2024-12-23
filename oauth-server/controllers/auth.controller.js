const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const UserModel = require("../models/user.model");

class AuthController {
    async register(req, res) {
        try {
            const { username, password, fullname } = req.body;

            const existingUser = await UserModel.getUserByUsername(username);
            if (existingUser) {
                return res.status(400).json({ error: "User already exists" });
            }

            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(password, salt);

            const newUser = await UserModel.createUser(
                username,
                passwordHash,
                fullname
            );

            const token = jwt.sign(
                { id: newUser.id, username: newUser.username },
                process.env.OAUTH_JWT_SECRET,
                { expiresIn: "1d" }
            );

            res.status(201).json({
                message: "User registered successfully",
                token,
            });
        } catch (error) {
            console.error("Registration error:", error);
            res.status(500).json({ error: "Server error during registration" });
        }
    }

    async login(req, res) {
        try {
            const { username, password } = req.body;

            const user = await UserModel.getUserByUsername(username);
            if (!user) {
                return res.status(401).json({ error: "Invalid credentials" });
            }

            const validPassword = await bcrypt.compare(
                password,
                user.password_hash
            );
            if (!validPassword) {
                return res.status(401).json({ error: "Invalid credentials" });
            }

            const token = jwt.sign(
                { id: user.id, username: user.username },
                process.env.OAUTH_JWT_SECRET,
                { expiresIn: "1d" }
            );

            res.json({
                message: "Login successful",
                token,
            });
        } catch (error) {
            console.error("Login error:", error);
            res.status(500).json({ error: "Server error during login" });
        }
    }
}

module.exports = new AuthController();
