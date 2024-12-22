// src/socket/index.js
const socketIO = require("socket.io");
const session = require("express-session");
const OnlineUsersManager = require("./onlineUsers");

function initializeSocket(server, sessionMiddleware) {
    const io = socketIO(server);

    io.use((socket, next) => {
        sessionMiddleware(socket.request, socket.request.res || {}, next);
    });

    const onlineUsersManager = new OnlineUsersManager(io);
    onlineUsersManager.initialize();

    return {
        io,
        onlineUsersManager,
    };
}

module.exports = initializeSocket;
