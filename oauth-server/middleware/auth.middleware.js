const jwt = require("jsonwebtoken");

class AuthMiddleware {
    async validateToken(req, res, next) {
        try {
            const token = req.headers.authorization?.split(" ")[1];

            if (!token) {
                return res.status(401).json({ error: "No token provided" });
            }

            const decoded = jwt.verify(token, process.env.OAUTH_JWT_SECRET);
            req.user = decoded;
            req.oauth = decoded;
            next();
        } catch (error) {
            return res.status(401).json({ error: "Invalid token" });
        }
    }
}

module.exports = new AuthMiddleware();
