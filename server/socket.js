import db from './config/config.js';

export function initializeSocket(io) {
	io.on('connection', (socket) => {
		console.log('A user connected', socket.id);

		const recentChatQuery = `
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
							)

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
							)
							ORDER BY sentAt DESC
						`;

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

								if (senderID === senderID) {
									db.query(recentChatQuery, [senderID, senderID, senderID, senderID], (err, result) => {
										console.log(`sender ${senderID}`);
										if (!err) {
											io.emit('recentChatResult', result);
										}
									});
									return;
								}

								if (receiverID === receiverID) {
									// Fetch for receiver
									db.query(recentChatQuery, [receiverID, receiverID, receiverID, receiverID], (err, result) => {
										console.log(`received ${receiverID}`);
										if (!err) {
											io.emit('recentChatResult', result);
										}
									});
									return;
								}
							} else {
								console.error('Error inserting message:', err);
							}
						});
					} else {
						// For file messages, just broadcast to all clients since DB insert was done in the upload endpoint
						io.emit('newMessage', { senderID, receiverID, username, message, messageType, fileUrl, groupID, chatType });

						db.query(recentChatQuery, [senderID, senderID, senderID, senderID], (err, result) => {
							if (!err) {
								io.emit('recentChatResult', result);
							}
						});

						// Fetch for receiver
						db.query(recentChatQuery, [receiverID, receiverID, receiverID, receiverID], (err, result) => {
							if (!err) {
								io.emit('recentChatResult', result);
							}
						});
					}
				} else if (chatType === 'group') {
					query = 'INSERT INTO messages (senderID, message, messageType, fileUrl, groupID) VALUES (?, ?, ?, ?, ?)';
					params = [senderID, message, messageType, fileUrl, groupID];

					console.log(`Group id is: ${groupID}`);

					if (messageType === 'text') {
						db.query(query, params, (err, result) => {
							if (!err) {
								io.emit('newMessage', { senderID, username, message, messageType, fileUrl, chatType, groupID });

								db.query(recentChatQuery, [senderID, senderID, senderID, senderID], (err, result) => {
									console.log(`sender ${senderID}`);
									if (!err) {
										io.emit('recentChatResult', result);
									}
								});

								// Fetch for receiver
								db.query(recentChatQuery, [receiverID, receiverID, receiverID, receiverID], (err, result) => {
									console.log(`received ${receiverID}`);
									if (!err) {
										io.emit('recentChatResult', result);
									}
								});
							} else {
								console.error('Error inserting message:', err);
							}
						});
					} else {
						// For file messages, just broadcast to all clients since DB insert was done in the upload endpoint
						io.emit('newMessage', { senderID, receiverID, username, message, messageType, fileUrl, groupID, chatType });

						db.query(recentChatQuery, [senderID, senderID, senderID, senderID], (err, result) => {
							if (!err) {
								io.emit('recentChatResult', result);
							}
						});

						// Fetch for receiver
						db.query(recentChatQuery, [receiverID, receiverID, receiverID, receiverID], (err, result) => {
							if (!err) {
								io.emit('recentChatResult', result);
							}
						});
					}
				}
			});
		});

		socket.on('recentChat', (userID) => {
			console.log('user id is: ', userID);

			db.query(recentChatQuery, [userID, userID, userID, userID], (err, result) => {
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
