import db from './config/config.js';

export function initializeSocket(io) {
	io.on('connection', (socket) => {
		console.log('A user connected', socket.id);

		let chatHistory = `SELECT
                            p.senderID, p.receiverID, p.message, p.messageType, p.fileUrl, u.username 
                        FROM private p JOIN users u 
                        ON p.senderID = u.userID
                        ORDER BY p.messageID ASC`;

		socket.on('requestChatHistory', () => {
			db.query(chatHistory, (err, results) => {
				if (err) {
					console.error('Error fetching chat history', err);
				} else {
					socket.emit('chat history', results);
				}
			});
		});

		socket.on('sendmessage', ({ senderID, receiverID, message, messageType, fileUrl, groupID, chatType }) => {
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
				let query;
				let params;

				if (chatType === 'private') {
					query = 'INSERT INTO private (senderID, receiverID, message, messageType, fileUrl) VALUES (?, ?, ?, ?, ?)';
					params = [senderID, receiverID, message, messageType, fileUrl];

					if (messageType === 'text') {
						db.query(query, params, (err, result) => {
							if (!err) {
								io.emit('newMessage', { senderID, receiverID, username, message, messageType, fileUrl, chatType });
							} else {
								console.error('Error inserting message:', err);
							}
						});
					} else {
						// For file messages, just broadcast to all clients since DB insert was done in the upload endpoint
						io.emit('newMessage', { senderID, username, message, messageType, fileUrl });
					}
				} else if (chatType === 'group') {
					query = 'INSERT INTO messages (senderID, message, messageType, fileUrl, groupID) VALUES (?, ?, ?, ?, ?)';
					params = [senderID, message, messageType, fileUrl, groupID];

					console.log(`Group id is: ${groupID}`);

					if (messageType === 'text') {
						db.query(query, params, (err, result) => {
							if (!err) {
								io.emit('newMessage', { senderID, username, message, messageType, fileUrl, chatType });
							} else {
								console.error('Error inserting message:', err);
							}
						});
					} else {
						// For file messages, just broadcast to all clients since DB insert was done in the upload endpoint
						io.emit('newMessage', { senderID, username, message, messageType, fileUrl });
					}
				}
			});
		});

		socket.on('recentChat', (userID) => {
			const query = `
							(SELECT 
								u.userID, 
								u.username,
								u.firstname,
								u.lastname,
								p.sentAt,
								'private' AS chatType
							FROM users u
							JOIN private p ON (p.senderID = u.userID OR p.receiverID = u.userID)
							WHERE (p.senderID = ? OR p.receiverID = ?) AND u.userID != ?
							ORDER BY p.sentAt DESC
							LIMIT 10)

							UNION

							(SELECT 
								g.groupID AS userID, 
								g.groupName AS username,  
								NULL AS firstname, 
								NULL AS lastname,
								m.sentAt,
								'group' AS chatType
							FROM groups g JOIN messages m ON g.groupID = m.groupID
							JOIN group_members gm ON gm.groupID = g.groupID
							WHERE gm.userID = ?
							ORDER BY m.sentAt DESC
							LIMIT 10)
						`;

			console.log('user id is: ', userID);

			db.query(query, [userID, userID, userID, userID], (err, result) => {
				if (err) {
					console.error('Error fetching recent chat', err);
				} else {
					socket.emit('recentChatResult', result);
				}
			});
		});

		socket.on('disconnect', () => {
			console.log('User disconnected:', socket.id);
		});
	});
}
