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
    if (req.cookies.token && jwt.verify(req.cookies.token, config.jwtSecret)) res.render('home', {username: jwt.decode(req.cookies.token).username});
    else res.redirect('/login');
})

app.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/login');
})

app.get('/register', (req, res) => {
    res.render('register');
})

app.get('/friend-requests', async (req, res) => {
    const username = jwt.verify(req.cookies.token, config.jwtSecret).username;
    
    try {
        const user = await User.findOne({ username }).populate('friendRequests');
        console.log('sent friend request');
        
        return res.status(200).json(user.friendRequests);
    } catch (err) {
        console.error(err);
        return res.status(500);
    }
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
                res.cookie('token', token, { httpOnly: false }); // making it httponly is kind of unsafe, but we need to access it from the client side to generate the private key client side
                res.redirect('/home');
            } else {
                const Error = 'Invalid username or password';
                res.render('login', {Error});
            }
        } else {
            const Error = 'Invalid username or password';
            res.render('login', {Error});
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
                    friends: [],
                    friendRequests: [],
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

app.post('/add-friend', async (req, res) => {
    const username = jwt.verify(req.cookies.token, config.jwtSecret).username;
    const friendUsername = req.body.friend;
    
    try {
        const user = await User.findOne({ username });
        const friend = await User.findOne({ username: friendUsername });

        if (!user || !friend) return res.status(404).send();
        if (username === friendUsername) return res.status(400).send();
        if (!friend.friends.includes(username) && !user.friends.includes(friendUsername) && !user.friendRequests.includes(friendUsername) && !friend.friendRequests.includes(username)) {
            friend.friendRequests.push(username);
            await friend.save();
            return res.status(200).send();
        } else if (user.friendRequests.includes(friendUsername)) {
            user.friends.push(friendUsername);
            friend.friends.push(username);
            user.friendRequests = user.friendRequests.filter(f => f !== friendUsername);
            friend.friendRequests = friend.friendRequests.filter(f => f !== username);
            await user.save();
            await friend.save();
            return res.status(200).send();
        } else if (friend.friendRequests.includes(username)) {
            // do nothing
            return res.status(200).send();
        } else {
            return res.status(400).send();
        }
    } catch (err) {
        console.error(err)
    }
})

app.listen(80)