const express = require('express');
const http = require('http');
const bcrypt = require('bcrypt');
const config = require('./config.json');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const userSockets = {};

// TODO - better chat css (stop autoscrolling on new message too) + home screen for when you have no friends or chats open + error message for when messages aren't sent
// TODO - key generation system for message encryption
// TODO - i should probably not have everything in one file but i'm too lazy to make more files rn

mongoose.connect(config.mongooseConnection + 'usersDB', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

// SECTION - Socket.io
io.on('connection', (socket) => {
    try {
        socket.username = jwt.verify(socket.handshake.auth.token, config.jwtSecret).username;
        if (!socket.username) return socket.disconnect();
        // console.log(socket.username + ' connected');
        userSockets[socket.username] = socket.id;

        socket.on('disconnect',  () => {
            // console.log(socket.username + ' disconnected');
            delete userSockets[socket.username];
        })

        socket.on('message', async (msg) => {
            // console.log(msg);
            const recipient = msg.recipient;
            msg.sender = socket.username;
            if (recipient) {
                const friend = await User.findOne({ username: recipient });
                if (!friend.friends.includes(socket.username)) return;
                const room = io.sockets.adapter.rooms.has(`${socket.username}-${recipient}`) ? `${socket.username}-${recipient}` : `${recipient}-${socket.username}`; // honestly there is definitely a better way to make rooms but if it works it works
                // console.log(room);
                io.to(room).emit('message', msg);
            }
        })
        let typingUsers = new Set();
        socket.on('typing', async (recipient) => {
            const sender = socket.username;
            // deny any other typing events from the sender temporarily for performance reasons
            if (typingUsers.has(sender)) return;
            typingUsers.add(sender);
            setTimeout(() => typingUsers.delete(sender), 3000);
            if (recipient) {
                const friend = await User.findOne({ username: recipient });
                if (!friend.friends.includes(sender)) return;
                const room = io.sockets.adapter.rooms.has(`${sender}-${recipient}`) ? `${sender}-${recipient}` : `${recipient}-${sender}`;
                io.to(room).emit('typing', sender);
            }
        })
        socket.on('open-room', async (username) => { // username parameter is the friend's username
            const user = await User.findOne({ username: socket.username });
            const friend = await User.findOne({ username });
            if (!user.friends.includes(username) || !friend.friends.includes(socket.username)) return;            
            const existingRoom = io.sockets.adapter.rooms.has(`${socket.username}-${username}`) ? `${socket.username}-${username}` : `${username}-${socket.username}`;
            if (existingRoom) {
                socket.join(existingRoom);
            } else {
                socket.join(`${socket.username}-${username}`);
            }
        })
    } catch (err) {
        console.error(err);
    }
})

//!SECTION

// middleware stuff or somethign idk
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(__dirname + '/public'));
app.use(require('./middleware/refreshToken.js'));
app.use(require('./middleware/checkExpiration.js'));

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
    // if the token is valid then it will render the home page
    if (req.cookies.token && jwt.verify(req.cookies.token, config.jwtSecret)) res.render('home', {username: jwt.decode(req.cookies.token).username});
    else {
        res.clearCookie('token');
        return res.redirect('/login');
    }
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
        return res.status(200).send(user.friendRequests);
    } catch (err) {
        console.error(err);
        return res.status(500);
    }
})

app.get('/friends', async (req, res) => {
    const username = jwt.verify(req.cookies.token, config.jwtSecret).username;
    try {
        const user = await User.findOne({ username }).populate('friends');
        return res.status(200).send(user.friends);
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
        if (!friend.friends.includes(username) && !user.friends.includes(friendUsername) && !user.friendRequests.includes(friendUsername) && !friend.friendRequests.includes(username)) { // if the user is not already friends with the friend, the friend is not already friends with the user, the user has not already sent a friend request to the friend, and the friend has not already sent a friend request to the user
            friend.friendRequests.push(username);
            await friend.save();
            io.to(userSockets[friendUsername]).emit('friend-request', username);
            return res.status(200).send();
        } else if (user.friendRequests.includes(friendUsername)) { // if the friend has already sent a friend request to the user, then accept the friend request
            user.friends.push(friendUsername);
            friend.friends.push(username);
            user.friendRequests = user.friendRequests.filter(f => f !== friendUsername);
            friend.friendRequests = friend.friendRequests.filter(f => f !== username);
            await user.save();
            await friend.save();
            io.to(userSockets[friendUsername]).emit('refresh');
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

app.post('/remove-friend', async (req, res) => {
    const username = jwt.verify(req.cookies.token, config.jwtSecret).username;
    const friendUsername = req.body.friend;
    
    try {
        const user = await User.findOne({ username });
        const friend = await User.findOne({ username: friendUsername });

        user.friends = user.friends.filter(f => f !== friendUsername);
        friend.friends = friend.friends.filter(f => f !== username);
        await user.save();
        await friend.save();
        io.to(userSockets[friendUsername]).emit('refresh');
        return res.status(200).send();
    } catch (err) {
        console.error(err);
        return res.status(500).send();
    }
})

app.post('/friend-requests', async (req, res) => {
    const username = jwt.verify(req.cookies.token, config.jwtSecret).username;
    const friendUsername = req.body.friend;
    
    try {
        if (req.body.accept === 'true') {
            const user = await User.findOne({ username });
            const friend = await User.findOne({ username: friendUsername });

            user.friends.push(friendUsername);
            friend.friends.push(username);
            user.friendRequests = user.friendRequests.filter(f => f !== friendUsername);
            friend.friendRequests = friend.friendRequests.filter(f => f !== username); // not necessary but just to be safe
            await user.save();
            await friend.save();
            io.to(userSockets[friendUsername]).emit('refresh');
            return res.status(200).send();
        } else { // if the user declines the friend request
            const user = await User.findOne({ username });
            user.friendRequests = user.friendRequests.filter(f => f !== friendUsername);
            await user.save();
            return res.status(200).send();
        }
    } catch (err) {
        console.error(err);
        return res.status(500).send();
    }
})

// app.listen(80);
server.listen(80);