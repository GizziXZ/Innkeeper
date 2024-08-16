const jwt = require('jsonwebtoken');
const config = require('../config.json');

function refreshToken(req,res,next) { // middleware to refresh the token if it's about to expire
    try {
        const token = req.cookies.token;
        if (token) {
            const decoded = jwt.decode(token);
            const currentTime = Date.now();
            const expiryTime = decoded.exp * 1000;
            const timeLeft = expiryTime - currentTime;

            // If the token is about to expire in the next 5 minutes (300000 ms)
            if (timeLeft < 300000) {
                const newToken = jwt.sign({ username: decoded.username }, config.jwtSecret, { expiresIn: '4h' });
                res.cookie('token', newToken, { httpOnly: false });
            }
        }
        next();
    } catch (err) {
        console.error(err);
        res.clearCookie('token');
        res.redirect('/login');
    }
}

module.exports = refreshToken;