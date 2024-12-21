const pgp = require("pg-promise")();

const connection = {
    host: process.env.OAUTH_DB_HOST || "localhost",
    port: process.env.OAUTH_DB_PORT || 5432,
    database: process.env.OAUTH_DB_NAME || "oauth_server",
    user: process.env.OAUTH_DB_USER || "postgres",
    password: process.env.OAUTH_DB_PASSWORD || "postgres",
};

const db = pgp(connection);

module.exports = db;
