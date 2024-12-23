const pgp = require("pg-promise")();

const connection = {
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || "oauth_server",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASS || "postgres",
};

const db = pgp(connection);

const tables = {
    users: `${process.env.SCHEMA}.users`,
    clients: `${process.env.SCHEMA}.oauth_clients`,
    sessions: `${process.env.SCHEMA}.user_sessions`,
    codes: `${process.env.SCHEMA}.auth_codes`,
};

module.exports = db;
module.exports.tables = tables;
