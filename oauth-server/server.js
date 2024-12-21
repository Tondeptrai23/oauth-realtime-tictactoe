require("dotenv").config();
const express = require("express");
const { engine } = require("express-handlebars");
const https = require("https");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());
app.use("/public", express.static(path.join(__dirname, "public")));

app.engine(
    "hbs",
    engine({
        extname: ".hbs",
        defaultLayout: "main",
        layoutsDir: path.join(__dirname, "views/layouts"),
        partialsDir: path.join(__dirname, "views/partials"),
    })
);
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));

app.use("/", require("./routes/index.route"));

const sslOptions = {
    key: fs.readFileSync(path.join(__dirname, "config/ssl/key.pem")),
    cert: fs.readFileSync(path.join(__dirname, "config/ssl/cert.pem")),
};

const PORT = process.env.OAUTH_PORT || 53003;
https.createServer(sslOptions, app).listen(PORT, () => {
    console.log(`Server running on https://localhost:${PORT}`);
});