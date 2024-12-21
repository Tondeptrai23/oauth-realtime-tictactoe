const express = require("express");
const router = express.Router();
const OAuthController = require("../controllers/oauth.controller");
const Middleware = require("../middleware/auth.middleware");

router.use(Middleware.validateToken);

router.post("/clients", OAuthController.registerClient.bind(OAuthController));

router.get("/clients", OAuthController.getClientsByUser.bind(OAuthController));

router.get(
    "/clients/:clientId",
    OAuthController.getClientById.bind(OAuthController)
);

router.put(
    "/clients/:clientId",
    OAuthController.updateClient.bind(OAuthController)
);

module.exports = router;
