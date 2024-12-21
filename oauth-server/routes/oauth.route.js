const express = require("express");
const router = express.Router();
const OAuthController = require("../controllers/oauth.controller");
const Middleware = require("../middleware/auth.middleware");

// router.use(Middleware.validateToken);

router.get(
    "/authorize",
    OAuthController.showAuthorizationForm.bind(OAuthController)
);
router.post(
    "/authorize",
    // Middleware.validateToken,
    OAuthController.handleAuthorization.bind(OAuthController)
);
router.post(
    "/token",
    // Middleware.validateToken,
    OAuthController.generateToken.bind(OAuthController)
);

module.exports = router;
