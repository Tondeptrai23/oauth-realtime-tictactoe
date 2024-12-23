const express = require("express");
const session = require("express-session");
const { engine } = require("express-handlebars");
const path = require("path");
const bodyParser = require("body-parser");
const initializePassport = require("./config/passport");
const passport = require("passport");
const { isAuthenticated } = require("./middleware/auth.middleware");
const pgSession = require("connect-pg-simple")(session);
const crypto = require("crypto");
const db = require("./config/database");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT || 22375;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const sessionMiddleware = session({
    store: new pgSession({
        pgPromise: db,
        tableName: "ttt_sessions",
        schemaName: "s22375",
    }),
    secret:
        process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex"),
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
    },
    name: "ttt.sid",
});

app.use(sessionMiddleware);

const io = new Server(httpServer);
io.use((socket, next) => {
    sessionMiddleware(socket.request, socket.request.res || {}, next);
});

const { OnlineUsersManager } = require("./socket/onlineUsers");
const { HomeChatManager } = require("./socket/homeChat");
const { GamesManager } = require("./socket/games");
const { GameLobbyManager } = require("./socket/lobby");
const { LobbyMessageManager } = require("./socket/lobbyChat");

const onlineUsersManager = new OnlineUsersManager(io);
const chatManager = new HomeChatManager(io, onlineUsersManager);
const gameManager = new GamesManager(io, onlineUsersManager);
const gameLobbyManager = new GameLobbyManager(io, onlineUsersManager);
const lobbyMessageManager = new LobbyMessageManager(io, onlineUsersManager);

onlineUsersManager.initialize();
chatManager.initialize();
gameManager.initialize();
gameLobbyManager.initialize();
lobbyMessageManager.initialize();

app.set("io", io);

initializePassport(passport);

app.use(passport.initialize());
app.use(passport.session());

app.engine(
    "hbs",
    engine({
        extname: ".hbs",
        defaultLayout: "main",
        layoutsDir: path.join(__dirname, "views/layouts"),
        partialsDir: path.join(__dirname, "views/partials"),
        helpers: {
            range: function (start, end) {
                const result = [];
                for (let i = start; i < end; i++) {
                    result.push(i);
                }
                return result;
            },

            eq: function (a, b) {
                return a === b;
            },

            and: function () {
                return Array.prototype.every.call(arguments, Boolean);
            },

            lookup: function (obj, field) {
                return obj && obj[field];
            },

            choose_color: function (row, col, hostColor, guestColor) {
                const sum = Number(row) + Number(col);
                return sum % 2 === 0 ? hostColor : guestColor;
            },

            formatDate: function (date) {
                return date.toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "numeric",
                    second: "numeric",
                    hour12: true,
                });
            },
        },
    })
);
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));

app.use((req, res, next) => {
    res.locals.isLobby = req.path === "/lobby";
    res.locals.isProfile = req.path === "/profile";
    res.locals.isLeaderboard = req.path === "/leaderboard";
    next();
});

app.use("/", require("./routes/auth.route"));
app.use("/", require("./routes/main.route"));

app.get("/", isAuthenticated, (req, res) => {
    res.render("home", {
        user: req.user,
    });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render("error", { error: err });
});

httpServer.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
