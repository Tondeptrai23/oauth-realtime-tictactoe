require("dotenv").config();
const express = require("express");
const { engine } = require("express-handlebars");
const https = require("https");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static("public"));

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
app.set("views", "./views");

app.use("/", require("./routes"));

const sslOptions = {
    key: fs.readFileSync(path.join(__dirname, "config/ssl/server.key")),
    cert: fs.readFileSync(path.join(__dirname, "config/ssl/server.crt")),
};

const PORT = process.env.OAUTH_PORT || 53003;
https.createServer(sslOptions, app).listen(PORT, () => {
    console.log(`Server running on https://localhost:${PORT}`);
});
