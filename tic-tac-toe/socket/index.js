// src/socket/index.js
const socketIO = require("socket.io");
const session = require("express-session");
const OnlineUsersManager = require("./onlineUsers");

function initializeSocket(server, sessionMiddleware) {
    const io = socketIO(server);

    // Use session middleware with Socket.IO
    io.use((socket, next) => {
        sessionMiddleware(socket.request, socket.request.res || {}, next);
    });

    // Initialize online users manager
    const onlineUsersManager = new OnlineUsersManager(io);
    onlineUsersManager.initialize();

    return {
        io,
        onlineUsersManager,
    };
}

module.exports = initializeSocket;
