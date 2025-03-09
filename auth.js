import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from './config.js';


const router = express.Router();

//Register 
router.post('/register', async (req, res) => {
    const { firstname, lastname, username, password } = req.body;
    const hashed_password = await bcrypt.hash(password, 10);
    
    db.query('INSERT INTO users (username, firstname, lastname, password) VALUES (?, ?, ?, ?)',
        [username, firstname, lastname, hashed_password], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });

            res.json({ 
                message: 'Registration successful',  
                redirectURL: 'index.html'  // Send the redirect path
            });
        }
    );
});

// Login
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.query('SELECT userID, username, password FROM users WHERE username = ?', [username], async (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(401).json({ message: 'User not found' });

        const user = results[0];
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) return res.status(401).json({ message: 'Invalid password' });

        const payload = {
            userID: user.userID,
            username: user.username,
            firstname: user.firstname,
            lastname: user.lastname
        }

        const token = jwt.sign(payload, process.env.SECRET_KEY, { expiresIn: '1h' });
        
        res.cookie('authToken', token, {
            httpOnly: true,
            secure: false,
            sameSite: 'Strict',
            maxAge: 3600000
        });
        
        res.json({ 
            message: 'Login successful',  
            redirectURL: 'chatbox.html'  // Send the redirect path
        });

    });
});

router.get('/protected', (req, res) => {
    const token = req.cookies.authToken;

    if(!token){
        return res.status(401).json({message: "Unauthorized"});
    }

    try{
        const secretkey = process.env.SECRET_KEY;
        const decoded = jwt.verify(token, secretkey);
        res.json({ message: "Access granded", user:decoded});
    } catch(err){
        res.status(401).json({message: "Invalid token"});
    }
});


export default router;

