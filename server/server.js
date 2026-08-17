const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const UniqueWeaponManager = require("./managers/UniqueWeaponManager");

const app = express();
app.use(express.json());
const server = http.createServer(app);
const io = new Server(server, {
    pingInterval: 25000,
    pingTimeout: 60000,
    transports: ["websocket", "polling"],
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000,
        skipMiddlewares: true
    }
});

const path = require("path");

app.use(express.static(path.join(__dirname, "../client"), {
    setHeaders(res, filePath) {
        // Add Service-Worker-Allowed header for sw.js to allow root scope
        if (filePath.endsWith('sw.js')) {
            res.setHeader('Service-Worker-Allowed', '/');
        }

        // Ensure manifest.json is served with correct content type
        if (filePath.endsWith('manifest.json')) {
            res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
        }

        if (filePath.endsWith(".html") || filePath.endsWith(".js") || filePath.endsWith(".css")) {
            res.setHeader("Content-Type", `${getContentType(filePath)}; charset=utf-8`);
            // Avoid stale CDN/browser assets after redeploys.
            res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
        }
    }
}));

// Serve root manifest.json and sw.js explicitly
app.get('/manifest.json', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/manifest.json'), {
        headers: {
            'Content-Type': 'application/manifest+json; charset=utf-8',
            'Cache-Control': 'no-store, no-cache, must-revalidate'
        }
    });
});

app.get('/sw.js', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/sw.js'), {
        headers: {
            'Content-Type': 'application/javascript; charset=utf-8',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'Service-Worker-Allowed': '/'
        }
    });
});

function getContentType(filePath) {
    if (filePath.endsWith(".html")) return "text/html";
    if (filePath.endsWith(".js")) return "application/javascript";
    if (filePath.endsWith(".css")) return "text/css";
    return "text/plain";
}

require("./socket/connection")(io);
require("./socket/matchmaking")(io);
require("./socket/battle")(io);
require("./socket/party")(io);
require("./socket/boss")(io);
require("./socket/ranking")(io);
require("./socket/disconnect")(io);

app.get("/api/unique/claims", (req, res) => {
    res.json(UniqueWeaponManager.getAllClaims());
});

app.post("/api/unique/claim", (req, res) => {
    const { type, playerId, playerName, wins } = req.body || {};
    if (!type || !playerId || !playerName) {
        return res.status(400).json({ success: false, message: "Missing required fields" });
    }
    if (wins < 500) {
        return res.status(400).json({ success: false, message: "Quest not completed (need 500 wins)" });
    }
    const result = UniqueWeaponManager.tryClaim(type, playerId, playerName);
    if (!result.success) {
        return res.json({ success: false, claimedBy: result.claimedBy });
    }
    res.json({ success: true, claim: result.claim });
});

app.post("/api/unique/claimDebug", (req, res) => {
    const { type, playerId, playerName, wins } = req.body || {};
    if (!type || !playerId || !playerName) {
        return res.status(400).json({ success: false, message: "Missing required fields" });
    }
    if (wins < 1) {
        return res.status(400).json({ success: false, message: "Quest not completed (need 1 win)" });
    }
    const result = UniqueWeaponManager.tryClaimDebug(type, playerId, playerName);
    if (!result.success) {
        return res.json({ success: false, claimedBy: result.claimedBy });
    }
    res.json({ success: true, claim: result.claim });
});

const PORT = process.env.PORT || 3000;

// Diagnostic logging
io.on('connection', (socket) => {
    console.log(`[${new Date().toISOString()}] Socket connected - ID: ${socket.id}`);

    socket.onAny((eventName, ...args) => {
        if (eventName !== 'ping' && eventName !== 'pong') {
            console.log(`[Socket] Event received: ${eventName} from ${socket.id}`);
        }
    });

    socket.on('disconnect', (reason) => {
        console.log(`[${new Date().toISOString()}] Socket disconnected - ID: ${socket.id} reason: ${reason}`);
    });
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