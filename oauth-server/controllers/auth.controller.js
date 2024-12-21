const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/database");

class AuthController {
    async register(req, res) {
        try {
            const { email, password, fullname } = req.body;

            const existingUser = await db.oneOrNone(
                "SELECT id FROM users WHERE email = $1",
                [email]
            );
            if (existingUser) {
                return res.status(400).json({ error: "User already exists" });
            }

            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(password, salt);

            const newUser = await db.one(
                "INSERT INTO users (email, password_hash, fullname) VALUES ($1, $2, $3) RETURNING id, email, fullname",
                [email, passwordHash, fullname]
            );

            const token = jwt.sign(
                { id: newUser.id, email: newUser.email },
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
            const { email, password } = req.body;

            const user = await db.oneOrNone(
                "SELECT id, email, password_hash FROM users WHERE email = $1",
                [email]
            );

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
                { id: user.id, email: user.email },
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
