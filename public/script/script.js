const socket = io('http://localhost:3000');
const messageInput = document.getElementById("messageInput");
const messages = document.getElementById("messages");
let userId = null;
let lastSenderId = null;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch("http://localhost:3000/cookie/protected", {
            method: "GET", 
            credentials: "include"
        });

        if (!response.ok) {
            throw new Error("Failed to fetch user information");
        }

        const data = await response.json();
        
        setupChat(data.user);

    } catch(err) {
        console.log("Something went wrong: ", err);
    }
});

function setupChat(data) {
    userId = data.userID; 

    // Load chat history
    socket.on("chat history", (history) => {
        lastSenderId = null; // Reset before loading history
        history.forEach((msg) => {
            displayMessage({
                senderID: msg.senderID, 
                username: msg.username,
                message: msg.message
            });
        });
    });

    // Receive new messages
    socket.on("newMessage", ({ senderID, username, message }) => {  
       displayMessage({ senderID, username, message });
    });

    function sendMessage() { 
        const message = messageInput.value.trim();
        if (message) {
            const messageData = { senderID: userId, message };
            socket.emit("sendmessage", messageData); 
            messageInput.value = ""; 
        }
    }

    function displayMessage(msg) {
        const messageWrapper = document.createElement("div");
        messageWrapper.classList.add("message-wrapper");

        const isNewSender = lastSenderId !== msg.senderID;
        
        if (isNewSender) {
            const nameElement = document.createElement("p");
            nameElement.textContent = msg.senderID === userId ? "You" : msg.username; 
            nameElement.classList.add("message-name");
            messageWrapper.appendChild(nameElement);
        }

        const messageElement = document.createElement("div");
        messageElement.textContent = msg.message;
        messageElement.classList.add("message-box");

        // Check if the message was sent by the current user
        if (msg.senderID === userId) {
            messageWrapper.classList.add("my-message"); // Align right
        } else {
            messageWrapper.classList.add("other-message"); // Align left
        }

        // Append message to the container
        messageWrapper.appendChild(messageElement);
        messages.appendChild(messageWrapper);

        lastSenderId = msg.senderID;

        messages.scrollTop = messages.scrollHeight;
    }
    document.getElementById('sendButton').addEventListener('click', sendMessage);
}