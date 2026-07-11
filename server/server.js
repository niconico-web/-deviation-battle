const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("../client"));

require("./socket/connection")(io);

server.listen(3000, () => {

    console.log("Server Start");

});