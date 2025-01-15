const pgp = require("pg-promise")();
const dotenv = require("dotenv");
dotenv.config();

const connection = {
    host: process.env.OAUTH_DB_HOST,
    port: process.env.OAUTH_DB_PORT,
    database: process.env.OAUTH_DB_NAME,
    user: process.env.OAUTH_DB_USER,
    password: process.env.OAUTH_DB_PASS,
};

const db = pgp(connection);

const tables = {
    users: `${process.env.OAUTH_SCHEMA}.ttt_users`,
    games: `${process.env.OAUTH_SCHEMA}.ttt_games`,
    moves: `${process.env.OAUTH_SCHEMA}.ttt_moves`,
    sessions: `${process.env.OAUTH_SCHEMA}.ttt_sessions`,
    chat_messages: `${process.env.OAUTH_SCHEMA}.ttt_chat_messages`,
};

module.exports = db;

module.exports.tables = tables;
