const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public")); // Serve static frontend files

let messages = []; // Store messages here

io.on("connection", (socket) => {
    console.log("A user connected");

    // Send stored messages to the new user
    socket.emit("chat history", messages);

    // When a new message is received
    socket.on("chat message", (msg) => {
        messages.push(msg); // Save message in array
        io.emit("chat message", msg); // Send message to all users
    });

    socket.on("disconnect", () => {
        console.log("A user disconnected");
    });
});

server.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});
