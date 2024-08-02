const express = require('express');
const bcrypt = require('bcrypt');
const session = require('express-session');
const config = require('./config.json');
const socketio = require('socket.io');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');

const app = express();

// TODO - login system, using a free mongodb database

mongoose.connect(config.mongooseConnection + 'usersDB', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

app.get('/', (req, res) => {
    res.redirect('/login');
})

app.get('/login', (req, res) => {
    const message = req.query.message;
    res.render('login', {message});
})

app.get('/home', (req, res) => {
    res.render('home');
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

async function CreateAccount(newUser) { //  REVIEW - function probably should be removed
    await newUser.save();
}

app.post('/login', async (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    try {
        const user = await User.findOne({ username })
        
        if (user) {
            console.log(user);
            
            if (bcrypt.compareSync(password, user.password)) {
                const token = jwt.sign({ username }, 'test', { expiresIn: '1h' }); // NOTE - change jwt secret later
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

                await CreateAccount(newUser);
                res.redirect('/login?message=' + encodeURIComponent("Account created successfully"));
            }
        } catch (err) {
            console.error(err);
            res.status(500).send('Internal Server Error');
        }
    }
});

app.listen(80)