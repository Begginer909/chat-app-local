import db from './config/config.js';

const users = new Map(); // Stores userID -> socketID

export function initializeSocket(io) {
	let senderSocket;
	let receiverSocket;
	io.on('connection', (socket) => {
		console.log('A user connected', socket.id);

		// Register user and store their socket ID
		socket.on('register', (userID) => {
			users.set(userID, socket.id);
			console.log(`User ${userID} registered with socket ${socket.id}`);

			socket.join(`private_${userID}`);

			// Join all group rooms this user is a member of
			db.query('SELECT groupID FROM group_members WHERE userID = ?', [userID], (err, groups) => {
				if (err) {
					console.error('Error fetching user groups:', err);
					return;
				}

				groups.forEach((group) => {
					socket.join(`group_${group.groupID}`);
					console.log(`User ${userID} joined group_${group.groupID} room`);
				});
			});
		});

		//Query to show recent chat for users and receiver
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

		socket.on('sendmessage', ({ senderID, receiverID, message, messageType, fileUrl, groupID, chatType, messageID }) => {
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
				senderSocket = users.get(senderID);
				receiverSocket = users.get(receiverID);

				if (chatType === 'private') {
					query = 'INSERT INTO private (senderID, receiverID, message, messageType, fileUrl) VALUES (?, ?, ?, ?, ?)';
					params = [senderID, receiverID, message, messageType, fileUrl];

					if (messageType === 'text') {
						db.query(query, params, (err, result) => {
							if (!err) {
								const messageID = result.insertId;

								db.query('INSERT INTO private_message_receipts (messageID, status) VALUES (?, ?)', [messageID, 'sent'], (err) => {
									if (err) {
										console.error('Error creating receipt record: ', err);
									}
								});

								console.log('Emitting newMessage:', { senderID, receiverID, username, message, messageType, fileUrl, groupID, chatType, messageID });

								// Update recent chat for sender
								db.query(recentChatQuery, [senderID, senderID, senderID, senderID], (err, senderResult) => {
									if (!err && senderSocket) {
										io.to(senderSocket).emit('recentChatResult', senderResult);
										io.to(`private_${senderID}`).emit('newMessage', { senderID, receiverID, username, message, messageType, fileUrl, groupID, chatType });
									}
								});

								// Update for receiver
								db.query(recentChatQuery, [receiverID, receiverID, receiverID, receiverID], (err, receiverResult) => {
									if (!err && receiverSocket) {
										io.to(receiverSocket).emit('recentChatResult', receiverResult);
										io.to(`private_${receiverID}`).emit('newMessage', { senderID, receiverID, username, message, messageType, fileUrl, groupID, chatType, messageID });

										db.query('UPDATE private_message_receipts SET status = ?, statusChangedAt = NOW() WHERE messageID = ?', ['delivered', messageID], (err) => {
											if (err) {
												console.error('Error updating receipt status');
												return;
											}
											if (senderSocket) {
												io.to(`private_${senderID}`).emit('messageStatus', {
													messageID,
													status: 'delivered',
													receiverID,
												});
												console.log('Working here');
												console.log(senderSocket);
												console.log('About to emit messageStatus with data:', {
													messageID,
													status: 'delivered',
													receiverID,
												});
												console.log('Sender socket ID:', senderSocket);
											}
										});
									}
								});
								//console.log(` scokeesease: ${socket.id}`);
							} else {
								console.error('Error inserting message:', err);
							}
						});
					} else {
						// For file messages, just broadcast to all clients since DB insert was done in the upload endpoint
						io.emit('newMessage', { senderID, receiverID, username, message, messageType, fileUrl, groupID, chatType, messageID });
					}
				} else if (chatType === 'group') {
					query = 'INSERT INTO messages (senderID, message, messageType, fileUrl, groupID) VALUES (?, ?, ?, ?, ?)';
					params = [senderID, message, messageType, fileUrl, groupID];

					console.log(`Group id is: ${groupID}`);

					if (messageType === 'text') {
						db.query(query, params, (err, result) => {
							if (!err) {
								const messageID = result.insertId;

								// Get all group members except sender
								db.query('SELECT userID FROM group_members WHERE groupID = ? AND userID != ?', [groupID, senderID], (err, members) => {
									if (err) {
										console.error('Error fetching group members:', err);
										return;
									}
									//Create receipt records for all members
									members.forEach((member) => {
										db.query('INSERT INTO group_message_receipts (messageID, userID, status) VALUES (?, ?, ?)', [messageID, member.userID, 'sent'], (err) => {
											if (err) console.error('Error creating group receipt record: ', err);

											//If member is online. mark as delivered
											const memberSocket = users.get(member.userID);
											if (memberSocket) {
												db.query('UPDATE group_message_receipts SET status = ?, statusChangedAt = NOW() WHERE messageID = ? AND userID = ?', ['delivered', messageID, member.userID], (err) => {
													if (err) console.error('Error updating group receipt status', err);
													else {
														// Notify sender about delivery status
														if (senderSocket) {
															io.to(senderSocket).emit('messageStatus', {
																messageID,
																status: 'delivered',
																userID: member.userID,
																groupID,
															});
														}
													}
												});
												console.log('Delivered success');
											}
										});
									});
								});
								// Emit new message to sender and all group members
								io.to(`group_${groupID}`).emit('newMessage', {
									senderID,
									username,
									message,
									messageType,
									fileUrl,
									chatType,
									groupID,
									messageID,
								});
							} else {
								console.error('Error inserting message:', err);
							}
						});
					} else {
						// For file messages, just broadcast to all clients since DB insert was done in the upload endpoint
						io.to(`group_${groupID}`).emit('newMessage', {
							senderID,
							username,
							message,
							messageType,
							fileUrl,
							chatType,
							groupID,
							messageID,
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

		//Handle message seen events
		socket.on('seenMessage', (data) => {
			const { messageID, senderID, userID, username, groupID, chatType } = data;

			if (chatType === 'private') {
				db.query('UPDATE private_message_receipts SET status = ?, statusChangedAt = NOW() WHERE messageID = ?', ['seen', messageID], (err) => {
					if (err) console.error('Error updating private receipt status to seen:', err);
					else {
						// Notify sender that message was seen
						const senderSocket = users.get(senderID);
						if (senderSocket) {
							io.to(senderSocket).emit('messageStatus', {
								messageID,
								status: 'seen',
							});
							console.log('About to emit messageStatus with data:', {
								messageID,
								status: 'delivered',
								senderID,
							});
						}

						console.log(`${senderSocket} --- ${receiverSocket}`);
					}
				});
			} else if (chatType === 'group') {
				db.query('UPDATE group_message_receipts SET status = ?, statusChangedAt = NOW() WHERE messageID = ? AND userID = ?', ['seen', messageID, userID], (err) => {
					if (err) console.error('Error updating group receipt status to seen:', err);
					else {
						// Get message sender ID
						db.query('SELECT senderID FROM messages WHERE messageID = ?', [messageID], (err, result) => {
							if (err || !result.length) {
								console.error('Error getting message sender:', err);
								return;
							}

							const messageSenderID = result[0].senderID;
							const senderSocket = users.get(messageSenderID);

							// Emit to sender and all group members
							if (senderSocket) {
								io.to(senderSocket).emit('messageStatus', {
									messageID,
									status: 'seen',
									userID,
									username,
									groupID,
								});
							}

							// Also broadcast to all group members
							io.to(`group_${groupID}`).emit('messageStatus', {
								messageID,
								status: 'seen',
								userID,
								username,
								groupID,
							});
						});
					}
				});
			}
		});

		socket.on('disconnect', () => {
			for (const [userID, socketID] of users.entries()) {
				if (socketID === socket.id) {
					console.log(`User ${userID} disconnected`);
					users.delete(userID);
					break;
				}
			}
		});
	});
}
