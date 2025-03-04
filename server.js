const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT;

app.use(express.static("public"));

let messages = []; // Store messages

io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    // Send chat history to the newly connected user
    socket.emit("chat history", messages);

    // Handle message sending
    socket.on("chat message", ({ id, message }) => {
        const messageData = { id, text: message };
        messages.push(messageData); // Save message in history
        io.emit("chat message", messageData); // Send to all users
    });

    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
