const socket = io();
const messageInput = document.getElementById("messageInput");
const messages = document.getElementById("messages");

let lastUserID = null;

socket.on("connect", () => {
    userId = socket.id; 
});

// Load chat history
socket.on("chat history", (history) => {
    history.forEach((msg) => displayMessage(msg));
});

// Receive messages
socket.on("chat message", (msg) => {
    displayMessage(msg);
});

// Send message function
function sendMessage() {
    const message = messageInput.value.trim();
    if (message) {
        const messageData = { userID: userId, message };
        socket.emit("chat message", messageData); // Send message to server
        messageInput.value = ""; // Clear input
    }
}

function displayMessage(msg) {
    const messageWrapper = document.createElement("div");
    messageWrapper.classList.add("message-wrapper");

    // Only show the name if it's a different user from the last message
    if (msg.userID !== lastUserID) {
        const nameElement = document.createElement("p");
        nameElement.textContent = msg.userID === userId ? "You" : msg.userID; 
        nameElement.classList.add("message-name");
        messageWrapper.appendChild(nameElement);
    }

    const messageElement = document.createElement("div");
    messageElement.textContent = msg.text; // Ensure msg.message is used
    messageElement.classList.add("message-box");

    // Check if the message was sent by the current user
    if (msg.userID === userId) {
        messageWrapper.classList.add("my-message"); // Align right
    } else {
        messageWrapper.classList.add("other-message"); // Align left
    }

    // Append message to the container
    messageWrapper.appendChild(messageElement);
    messages.appendChild(messageWrapper);

    // Update last user ID
    lastUserID = msg.userID;

    // Auto-scroll to the latest message
    messages.scrollTop = messages.scrollHeight;
}

