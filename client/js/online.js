const socket = io();

document.getElementById("createRoom").onclick = () => {

    socket.emit("createRoom");

};

document.getElementById("joinRoom").onclick = () => {

    const room =

    document.getElementById("roomInput")

    .value

    .trim()

    .toUpperCase();

    socket.emit("joinRoom", room);

};

socket.on("roomCreated", (roomId) => {

    alert("ルームコード\n\n" + roomId);

});

socket.on("joinFailed", () => {

    alert("ルームが存在しません。");

});

socket.on("roomReady", () => {

    location.href = "battle.html";

});