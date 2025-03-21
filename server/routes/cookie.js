import express from 'express';
import jwt from 'jsonwebtoken';

const router = express.Router();

router.get('/protected', (req, res) => {
	const token = req.cookies.authToken; // Retrieve token from cookies

	if (!token) {
		return res.status(401).json({ message: 'Unauthorized' });
	}

	try {
		const secretkey = process.env.SECRET_KEY;
		const decoded = jwt.verify(token, secretkey);
		res.json({ message: 'Access granted', user: decoded });
	} catch (err) {
		res.status(401).json({ message: 'Invalid token' });
	}
});

router.get('/checkAuth', (req, res) => {
	const token = req.cookies.authToken;

	if (!token) {
		return res.json({ isAuthenticated: false });
	}

	return res.json({ isAuthenticated: true });
});

export default router;
