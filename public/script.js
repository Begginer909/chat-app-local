const socket = io();
const messageInput = document.getElementById("messageInput");
const messages = document.getElementById("messages");

// Load chat history
socket.on("chat history", (history) => {
    history.forEach((msg) => displayMessage(msg));
});

// Receive and display messages
socket.on("chat message", (msg) => {
    displayMessage(msg);
});

function sendMessage() {
    const message = messageInput.value.trim();
    if (message) {
        socket.emit("chat message", message); // Send message to server
        messageInput.value = ""; // Clear input
    }
}

// Function to display messages
function displayMessage(msg) {
    const messageElement = document.createElement("div");
    messageElement.textContent = msg;
    messages.appendChild(messageElement);
    messages.scrollTop = messages.scrollHeight;
}
