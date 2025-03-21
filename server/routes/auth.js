import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../config/config.js';

const router = express.Router();

//Register
router.post('/register', async (req, res) => {
	try {
		const { firstname, lastname, username, password } = req.body;

		if (!firstname || !lastname || !username || !password) {
			return res.status(400).json({ message: 'All fields are required' });
		}

		// Check if the username already exists
		db.query('SELECT * FROM users WHERE username = ?', [username], async (err, results) => {
			if (err) {
				return res.status(500).json({ message: 'Database error' });
			}
			if (results.length > 0) {
				return res.status(409).json({ message: 'Username already exists' });
			}

			// If username is unique, proceed with hashing and inserting
			const hashed_password = await bcrypt.hash(password, 10);

			db.query('INSERT INTO users (username, firstname, lastname, password) VALUES (?, ?, ?, ?)', [username, firstname, lastname, hashed_password], (err, result) => {
				if (err) {
					return res.status(500).json({ message: 'Database error' });
				}

				res.json({
					message: 'Registration successful',
					redirectURL: 'index.html',
				});
			});
		});
	} catch (err) {
		res.status(500).json({ message: 'Username already exists' });
	}
});

// Login
router.post('/login', (req, res) => {
	const { username, password } = req.body;
	db.query('SELECT userID, username, password FROM users WHERE username = ?', [username], async (err, results) => {
		if (err) return res.status(500).json({ error: err.message });
		if (results.length === 0) return res.status(401).json({ message: 'Username or Password is invalid' });

		const user = results[0];
		const isValidPassword = await bcrypt.compare(password, user.password);
		if (!isValidPassword) return res.status(401).json({ message: 'Username or Password is invalid' });

		const payload = {
			userID: user.userID,
			username: user.username,
		};

		const token = jwt.sign(payload, process.env.SECRET_KEY, { expiresIn: '1h' });

		res.cookie('authToken', token, {
			httpOnly: true,
			secure: false,
			sameSite: 'Strict',
			maxAge: 3600000,
		});

		res.json({
			message: 'Login successful',
			redirectURL: 'chatbox.html', // Send the redirect path
		});
	});
});

router.post('/logout', (req, res) => {
	res.clearCookie('authToken', {
		httpOnly: true,
		secure: false,
		sameSite: 'Strict',
	});
	res.json({ message: 'Logged out Sucessfully' });
});

export default router;
