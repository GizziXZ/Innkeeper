const express = require('express');
const bcrypt = require('bcrypt');
const config = require('./config.json');
const socketio = require('socket.io');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

const app = express();

// TODO - Home page

mongoose.connect(config.mongooseConnection + 'usersDB', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(__dirname + '/public'));

app.get('/', (req, res) => {
    if (req.cookies.token && jwt.verify(req.cookies.token, config.jwtSecret)) {
        res.redirect('/home');
    } else {
        res.redirect('/login');
    }
})

app.get('/login', (req, res) => {
    const message = req.query.message;
    res.render('login', {message});
})

app.get('/home', (req, res) => {
    if (req.cookies.token && jwt.verify(req.cookies.token, config.jwtSecret)) res.render('home');
    else res.redirect('/login');
})

app.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/login');
})

app.get('/register', (req, res) => {
    res.render('register');
})

// SECTION - POST requests

/**
 * @typedef {import('mongoose').Model} UserModel
 */

/**
 * @type {UserModel}
 */
const User = require('./models/users');

app.post('/login', async (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    try {
        const user = await User.findOne({ username })
        
        if (user) {
            if (bcrypt.compareSync(password, user.password)) {
                const token = jwt.sign({ username }, config.jwtSecret, { expiresIn: '4h' });
                res.cookie('token', token, { httpOnly: true });
                res.redirect('/home');
            } else {
                res.redirect('/login?message=' + encodeURIComponent('Invalid username or password'));
            }
        } else {
            res.redirect('/login?message=' + encodeURIComponent('Invalid username or password'));
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/register', async (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    if (!username.length || username.substring(0,1) === ' ' || !username.replace((/\s/g, '').length)) { // If username is empty or starts with a space or is all spaces then return error
        const usernameError = 'Username must be atleast 1 character, not start with a space or be all spaces.'
        return res.render('register', {usernameError})
    } else if (password.length < 5) { // If password is less than 5 characters then return error
        const passwordError = 'Password must be atleast 5 characters'
        return res.render('register', {passwordError})
    } else {
        try {
            const existingUser = await User.findOne({ username: username });
            if (existingUser) {
                const usernameError = 'Username already exists'
                return res.render('register', {usernameError})
            } else {
                const hash = bcrypt.hashSync(password, 10)

                const newUser = new User({
                    username: username,
                    password: hash,
                });

                await newUser.save();
                res.redirect('/login?message=' + encodeURIComponent("Account created successfully"));
            }
        } catch (err) {
            console.error(err);
            res.status(500).send('Internal Server Error');
        }
    }
});

app.listen(80)