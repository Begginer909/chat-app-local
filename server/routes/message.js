import db from '../config/config.js';
import express from 'express';

const router = express.Router();

router.post('/recent', (req, res) => {
	const { search } = req.body;

	if (!search) {
		return res.status(400).json({ error: 'Search term is required' });
	}

	const sql = `SELECT firstname, lastname, userID
                 FROM users
                 WHERE CONCAT(firstname, ' ', lastname) LIKE ?
                 OR firstname LIKE ? OR lastname LIKE ?`;

	const searchTerm = `%${search}%`;

	db.query(sql, [searchTerm, searchTerm, searchTerm], (err, result) => {
		if (err) {
			console.error('Error on fetching users', err);
		} else {
			res.json(result);
		}
	});
});

router.post('/getMessages', (req, res) => {
	const { userID, otherUserID, groupID, chatType } = req.body;
	let query;
	let params;
	if (chatType === 'private') {
		query = `
			SELECT u.userID, p.senderID, p.receiverID, u.username, p.message, p.sentAt
			FROM private p
			JOIN users u ON u.userID = p.senderID
			WHERE (p.senderID = ? AND p.receiverID = ?) OR (p.senderID = ? AND p.receiverID = ?)
			ORDER BY p.sentAt ASC`;

		params = [userID, otherUserID, otherUserID, userID];
	} else if (chatType === 'group') {
		query = `
			SELECT u.userID, u.username, m.senderID, m.message, m.sentAt
			FROM messages m
			JOIN users u ON u.userID = m.senderID
			WHERE m.groupID = ?
			ORDER BY m.sentAt ASC`;

		params = [groupID];
	}

	db.query(query, params, (err, results) => {
		if (err) {
			console.error('Error fetching messages:', err);
			return res.status(500).json({ error: 'Database error' });
		}
		res.json(results);
	});
});

router.get('/users', async (req, res) => {
	try {
		const { userId } = req.query;

		const query = 'SELECT userID, firstname, lastname FROM users WHERE userID != ?';

		db.query(query, [userId], (err, result) => {
			if (err) {
				console.error('Something went wrong', err);
			} else {
				return res.json(result);
			}
		});
	} catch (error) {
		console.error('Error fetching users: ', err);
		res.status(500).json({ message: 'Server Error' });
	}
});

router.post('/createGroup', async (req, res) => {
	const { groupName, members, creatorID } = req.body;

	if (!groupName || members.length === 0) return res.status(400).json({ message: 'Invalid data' });
	try {
		const query = `INSERT INTO groups (groupName) VALUES (?)`;

		db.query(query, [groupName], (err, result) => {
			if (err) {
				console.error('Something went wrong', err);
			}

			const groupID = result.insertId;

			// Ensure the creator is included in the members list
			if (!members.includes(creatorID.toString())) {
				members.push(creatorID.toString());
			}

			// Insert members
			const values = members.map((userID) => [groupID, userID]);
			if (values.length > 0) {
				const insertMembers = 'INSERT INTO group_members (groupID, userID) VALUES ?';

				db.query(insertMembers, [values], (err) => {
					if (err) {
						console.error('Error inserting members:', err);
						return res.status(500).json({ message: 'Error adding members' });
					}

					const systemMessage = `"${groupName}" was created`;
					const insertMessage = `INSERT INTO messages (groupID, senderID, message, messageType)
										VALUES (?, ?, ?, ?)`;

					db.query(insertMessage, [groupID, null, systemMessage, 'system'], (err) => {
						if (err) {
							console.error('Error inserting system message', err);
							return res.status(500).json({ message: 'Error adding system message' });
						}
						res.json({ message: 'Group created successfully', groupID });
					});
				});
			} else {
				res.json({ message: 'Group created successfully, but no members added', groupID });
			}
		});
	} catch (error) {
		console.error('Error creating group:', error);
		res.status(500).json({ message: 'Server error' });
	}
});

export default router;
