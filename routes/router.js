const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/users');
const config = require('../config.json');
const router = express.Router();

router.get('/', (req, res) => {
    if (req.cookies.token && jwt.verify(req.cookies.token, config.jwtSecret)) {
        res.redirect('/home');
    } else {
        res.redirect('/login');
    }
})

router.get('/login', (req, res) => {
    const message = req.query.message;
    res.render('login', {message});
})

router.get('/home', (req, res) => {
    // if the token is valid then it will render the home page
    if (req.cookies.token && jwt.verify(req.cookies.token, config.jwtSecret)) res.render('home', {username: jwt.decode(req.cookies.token).username});
    else {
        res.clearCookie('token');
        return res.redirect('/login');
    }
})

router.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/login');
})

router.get('/register', (req, res) => {
    res.render('register');
})

router.get('/friend-requests', async (req, res) => {
    try {
        if (!req.cookies.token) return res.status(401).send();
        const username = jwt.verify(req.cookies.token, config.jwtSecret).username;
        const user = await User.findOne({ username }).populate('friendRequests');
        return res.status(200).send(user.friendRequests);
    } catch (err) {
        console.error(err);
        return res.status(500);
    }
})

router.get('/friends', async (req, res) => {
    try {
        if (!req.cookies.token) return res.status(401).send();
        const username = jwt.verify(req.cookies.token, config.jwtSecret).username
        const user = await User.findOne({ username }).populate('friends');
        return res.status(200).send(user.friends);
    } catch (err) {
        console.error(err);
        return res.status(500);
    }
})

module.exports = router;