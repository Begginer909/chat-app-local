import db from '../config/config.js';
import express from 'express';

const router = express.Router();

// Store private messages
app.post('/api/privateMessages', async (req, res) => {
    const { senderID, receiverID, message } = req.body;

    try {
        await db.query(
            'INSERT INTO private (senderID, receiverID, message, createdAt) VALUES (?, ?, ?, NOW())',
            [senderID, receiverID, message]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Fetch private messages
app.get('/api/privateMessages', async (req, res) => {
    const { userID, targetUserID } = req.query;

    try {
        const [messages] = await db.query(
            `SELECT * FROM private WHERE (senderID = ? AND receiverID = ?) OR (senderID = ? AND receiverID = ?) ORDER BY createdAt ASC`,
            [userID, targetUserID, targetUserID, userID]
        );
        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Fetch private chat users
app.get('/api/privateChats', async (req, res) => {
    const { userID } = req.query;

    try {
        const [chats] = await db.query(
            `SELECT DISTINCT users.userID, users.username 
             FROM private 
             JOIN users ON (private.senderID = users.userID OR private.receiverID = users.userID)
             WHERE (private.senderID = ? OR private.receiverID = ?) AND users.userID != ?`,
            [userID, userID, userID]
        );
        res.json(chats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
