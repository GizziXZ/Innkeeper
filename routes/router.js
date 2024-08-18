const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/users');
const config = require('../config.json');
const router = express.Router();

router.get('/', (req, res) => {
    try {
        if (req.cookies.token && jwt.verify(req.cookies.token, config.jwtSecret)) {
            res.redirect('/home');
        } else {
            res.redirect('/login');
        }
    } catch (err) {
        console.error(err);
        res.clearCookie('token');
        res.redirect('/login', {message: err.message});
    }
});

router.get('/login', (req, res) => {
    const message = req.query.message;
    res.render('login', {message});
});

router.get('/home', (req, res) => {
    try {
        // if the token is valid then it will render the home page
        if (req.cookies.token && jwt.verify(req.cookies.token, config.jwtSecret)) res.render('home', {username: jwt.decode(req.cookies.token).username});
        else {
            res.clearCookie('token');
            return res.redirect('/login');
        }
    } catch (err) {
        console.error(err);
        res.clearCookie('token');
        return res.redirect('/login', {message: err.message});
    }
});

router.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/login');
});

router.get('/register', (req, res) => {
    res.render('register');
});

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
});

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
});

router.get('/blocked-users', async (req, res) => {
    const username = jwt.verify(req.cookies.token, config.jwtSecret).username;
    try {
        const user = await User.findOne({ username });
        const blocked = user.blocked || [];
        return res.status(200).send(blocked);
    } catch(err) {
        console.error(err);
        return res.status(500).send();
    }
});

router.get('/status', async (req, res) => {
    const username = jwt.verify(req.cookies.token, config.jwtSecret).username;
    try {
        const friend = req.query.user;
        const user = await User.findOne({ username: friend });
        if (!user) return res.status(404).send();
        if (!user.friends.includes(username)) return res.status(403).send();
        if (!user.status) return res.status(204).send();
        return res.status(200).send(user.status);
    } catch(err) {
        console.error(err);
        return res.status(500).send();
    }
});

router.get('/profile-picture', async (req, res) => {
    const username = jwt.verify(req.cookies.token, config.jwtSecret).username;
    try {
        if (!req.query.user) {
            const user = await User.findOne({ username });
            if (!user) return res.status(404).send();
            if (!user.profilePicture) return res.status(204).send();
            return res.status(200).send(user.profilePicture);
        } else {
            const user = await User.findOne({ username: req.query.user });
            if (!user) return res.status(404).send();
            if (!user.profilePicture) return res.status(204).send();
            return res.status(200).send(user.profilePicture);
        }
    } catch(err) {
        console.error(err);
        return res.status(500).send();
    }
});

module.exports = router;