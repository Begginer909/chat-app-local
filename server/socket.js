import db from './config/config.js';

export function initializeSocket(io) {
	io.on('connection', (socket) => {
		console.log('A user connected', socket.id);

		const chatHistory = `SELECT
                            m.senderID, m.message, m.messageType, m.fileUrl, u.username 
                        FROM messages m JOIN users u 
                        ON m.senderID = u.userID 
                        ORDER BY m.messageID ASC`;

		socket.on('requestChatHistory', () => {
			db.query(chatHistory, (err, results) => {
				if (err) {
					console.error('Error fetching chat history', err);
				} else {
					socket.emit('chat history', results);
				}
			});
		});

		socket.on('sendmessage', ({ senderID, message, messageType, fileUrl }) => {
			db.query('SELECT username FROM users WHERE userID = ?', [senderID], (err, results) => {
				if (err) {
					console.error('Database error:', err);
					return;
				}

				if (results.length === 0) {
					console.error('User not found');
					return;
				}

				const username = results[0].username;

				if (messageType === 'text') {
					db.query('INSERT INTO messages (senderID, message, messageType, fileUrl) VALUES (?, ?, ?, ?)', [senderID, message, messageType, fileUrl], (err, result) => {
						if (!err) {
							io.emit('newMessage', { senderID, username, message, messageType, fileUrl });
						} else {
							console.error('Error inserting message:', err);
						}
					});
				} else {
					// For file messages, just broadcast to all clients since DB insert was done in the upload endpoint
					io.emit('newMessage', { senderID, username, message, messageType, fileUrl });
				}
			});
		});

		socket.on('disconnect', () => {
			console.log('User disconnected:', socket.id);
		});
	});
}
