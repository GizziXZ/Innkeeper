const jwt = require('jsonwebtoken');

function checkExpiration(req, res, next) {
    // just makes it so that if the token is expired it will redirect to the login page
    if (jwt.decode(req.cookies.token).exp * 1000 < Date.now()) {
        res.clearCookie('token');
        return res.redirect('/login');
    }
    next();
}

module.exports = checkExpiration;