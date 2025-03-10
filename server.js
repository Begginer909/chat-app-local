import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import dotenv from "dotenv";
import db from './config.js';
import bodyParser from 'body-parser';
import authRoutes from './auth.js';
import cookieRoutes from './cookie.js';
import cors from 'cors';
import cookie from 'cookie-parser';


dotenv.config();

const app = express();
const server = http.createServer(app);


const io = new Server(server,{
    cors:{
        origin: "http://localhost",
        method: ['GET', 'POST', 'PUT', 'DELETE'],
        credentials: true
    }
});

const PORT = process.env.PORT;

app.use(cors({
    origin: "http://localhost",
    method: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));

app.use(bodyParser.json());
app.use(cookie());

app.use('/auth', authRoutes);
app.use('/cookie', cookieRoutes);

io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    const chatHistory = `SELECT
                            m.senderID, m.message, u.username
                        FROM messages m JOIN users u 
                        ON m.senderID = u.userID 
                        ORDER BY m.messageID ASC`;

    socket.on("requestChatHistory", () => {
        db.query(chatHistory, (err, results) => {
            if(err){
                console.error("Error fetching chat history", err)
            } else{
                socket.emit("chat history", results);
            }
        });
    });

    socket.on('sendmessage', ({senderID, message }) => {
        db.query('SELECT username FROM users WHERE userID = ?', [senderID], (err, results) => {
            if (err) {
                console.error("Database error:", err);
                return;
            }
    
            if (results.length === 0) {
                console.error("User not found");
                return;
            }
    
            const username = results[0].username;

            db.query('INSERT INTO messages (senderID, message) VALUES (?, ?)', [senderID, message], (err, result) => {
                if (!err) {
                    io.emit('newMessage', { senderID, username, message });
                } else {
                    console.error("Error inserting message:", err);
                }
            });
        });
    });

    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
