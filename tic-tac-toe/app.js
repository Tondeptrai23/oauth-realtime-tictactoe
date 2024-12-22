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
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 22375;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.use(
    session({
        store: new pgSession({
            pgPromise: db,
            tableName: "ttt_sessions",
        }),
        secret:
            process.env.SESSION_SECRET ||
            crypto.randomBytes(32).toString("hex"),
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: false,
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000,
        },
        name: "ttt.sid",
    })
);

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
            eq: (a, b) => a === b,
        },
    })
);
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));

app.use("/", require("./routes/main.route"));
app.use("/", require("./routes/auth.route"));

app.get("/", isAuthenticated, (req, res) => {
    res.render("home", {
        user: req.user,
    });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render("error", { error: err });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
