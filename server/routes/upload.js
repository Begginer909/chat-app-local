import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import db from '../config/config.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, '../uploads');

if (!fs.existsSync(uploadDir)) {
	fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, uploadDir);
	},
	filename: (req, file, cb) => {
		const userId = req.body.userId || 'unknown';
		const timestamp = Date.now();
		const ext = path.extname(file.originalname);
		cb(null, `${userId}_${timestamp}${ext}`);
	},
});

const upload = multer({ storage });

// Route for multiple file uploads
router.post('/upload', upload.array('files', 10), (req, res) => {
	const { senderID, message, chatType, groupID } = req.body;
	// Allows up to 10 files
	if (!req.files || req.files.length === 0) {
		if (req.body.message) {
			return res.json({ message: 'Text-only message' });
		}
		return res.status(400).json({ error: 'No files uploads' });
	}

	const fileUrls = req.files.map((file) => `/uploads/${file.filename}`);
	//Convert file Urls to a JSON string for storage in MySQL
	const fileUrlsJSON = JSON.stringify(fileUrls);
	const messageToSave = message && message.trim() !== '' ? message : '';
	// Assuming only one file type is uploaded per request
	const messageType = req.files[0].mimetype.startsWith('image') ? 'image' : 'file';

	let sql;
	let params;

	if (chatType == 'group') {
		sql = 'INSERT INTO messages (senderID, groupID, message, messageType, fileUrl) VALUES (?, ?, ?, ?, ?)';
		params = [userId, groupID, messageToSave, messageType, fileUrlsJSON];
	} else if (chatType == 'private') {
		sql = 'INSERT INTO private (senderID, receiverID, message, messageType, fileUrl) VALUES (?, ?, ?, ?, ?)';
		params = [userId, receiverID, messageToSave, messageType, fileUrlsJSON];
	} else {
		return res.status(400).json({ error: 'Invalid chatType' });
	}

	db.query(sql, params, (err, result) => {
		if (err) {
			console.error('Database error', err);
			return res.status(500).json({ error: 'Database error' });
		}
		res.json({ message: 'File uploaded successfully', fileUrl: fileUrlsJSON, fileUrls });
	});
});

export default router;
