const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const path = require("path");

app.use(express.static(path.join(__dirname, "../client"), {
    setHeaders(res, filePath) {
        if (filePath.endsWith(".html") || filePath.endsWith(".js") || filePath.endsWith(".css")) {
            res.setHeader("Content-Type", `${getContentType(filePath)}; charset=utf-8`);
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

server.listen(3000, () => {

    console.log("Server Start");

});