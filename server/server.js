const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    pingInterval: 25000,
    pingTimeout: 60000,
    transports: ["websocket", "polling"],
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    allowEIO3: true
});

const path = require("path");

app.use(express.static(path.join(__dirname, "../client"), {
    setHeaders(res, filePath) {
        if (filePath.endsWith(".html") || filePath.endsWith(".js") || filePath.endsWith(".css")) {
            res.setHeader("Content-Type", `${getContentType(filePath)}; charset=utf-8`);
            // Avoid stale CDN/browser assets after redeploys.
            res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
        }
    }
}));

function getContentType(filePath) {
    if (filePath.endsWith(".html")) return "text/html";
    if (filePath.endsWith(".js")) return "application/javascript";
    if (filePath.endsWith(".css")) return "text/css";
    return "text/plain";
}

require("./socket/connection")(io);

const PORT = process.env.PORT || 3000;

// Diagnostic logging
io.on('connection', (socket) => {
    console.log(`[${new Date().toISOString()}] Socket connected - ID: ${socket.id}`);
});

io.on('error', (err) => {
    console.error(`[${new Date().toISOString()}] Socket.io error:`, err);
});

// Error handling
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

server.on('error', (err) => {
    console.error('Server error:', err);
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use`);
    }
    process.exit(1);
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`[${new Date().toISOString()}] Server Start on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'production'}`);
});