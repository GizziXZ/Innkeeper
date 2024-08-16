const jwt = require('jsonwebtoken');

function checkExpiration(req, res, next) {
    try {
        // just makes it so that if the token is expired it will redirect to the login page
        if (req.cookies.token) {
            const decodedToken = jwt.decode(req.cookies.token);
            if (!decodedToken) {
                res.clearCookie('token');
                return res.redirect('/login');
            }
            if (decodedToken.exp * 1000 < Date.now()) {
                res.clearCookie('token');
                return res.redirect('/login');
            }
        }
        next();
    } catch (err) {
        console.error(err);
        res.clearCookie('token');
        res.redirect('/login');
    }
}

module.exports = checkExpiration;