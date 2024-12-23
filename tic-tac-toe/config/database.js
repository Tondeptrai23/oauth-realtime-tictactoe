const pgp = require("pg-promise")();
const dotenv = require("dotenv");
dotenv.config();

const connection = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
};

const db = pgp(connection);

const tables = {
    users: `${process.env.SCHEMA}.ttt_users`,
    games: `${process.env.SCHEMA}.ttt_games`,
    moves: `${process.env.SCHEMA}.ttt_moves`,
    sessions: `${process.env.SCHEMA}.ttt_sessions`,
    chat_messages: `${process.env.SCHEMA}.ttt_chat_messages`,
};

module.exports = db;

module.exports.tables = tables;
