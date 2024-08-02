const express = require('express');
const session = require('express-session');
const config = require('./config.json');
const socketio = require('socket.io');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');

const app = express();

// TODO - login system, using a free mongodb database

mongoose.connect(config.mongooseConnection + '/usersDB', {
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
    res.render('login');
})

app.get('/register', (req, res) => {
    res.render('register');
})

// SECTION - POST requests

const User = require('./models/users');

async function CreateAccount(newUser) {
    console.log('Account created');
    await newUser.save();
    console.log('Account saved');
}

app.post('/login', (req, res) => {

});

app.post('/register', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    const newUser = new User({
        username: username,
        password: password,
    });

    if (!username.length || username.substring(0,1) === ' ' || !username.replace((/\s/g, '').length)) { // If username is empty or starts with a space or is all spaces then return error
        const usernameError = 'Username must be atleast 1 character, not start with a space or be all spaces.'
        return res.render('register', {usernameError})
    } else if (password.length < 5) { // If password is less than 5 characters then return error
        const passwordError = 'Password must be atleast 5 characters'
        return res.render('register', {passwordError})
    } else {
        try {
            if (User.find({username}).size < 0) {
                const usernameError = 'Username already exists'
                return res.render('register', {usernameError})
            } else {
                CreateAccount(newUser);
                // res.redirect('/login?message=' + encodeURIComponent("Account created successfully"));
            }
        } catch (err) {
            console.error(err);
            res.status(500).send('Internal Server Error');
        }
    }
});

app.listen(80)