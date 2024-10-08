const bcrypt = require('bcrypt');
const config = require('../config.json');
const jwt = require('jsonwebtoken');
const router = require('../routes/router');
const { emitToUser } = require('../sockets/socketHandler');

/**
 * @typedef {import('mongoose').Model} UserModel
 */

/**
 * @type {UserModel}
 */
const User = require('../models/users');

router.post('/login', async (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    try {
        const user = await User.findOne({ username })
        if (user) {
            if (bcrypt.compareSync(password, user.password)) {
                const token = jwt.sign({ username }, config.jwtSecret, { expiresIn: '4h' });
                res.cookie('token', token, { httpOnly: false }); // httpOnly is false so that the client can access the token and use it for socket.io
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

router.post('/register', async (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    if (!username.length || username.substring(0,1) === ' ' || !username.replace((/\s/g, '').length) || username.includes('-')) { // If username is empty or starts with a space or is all spaces then return error
        const usernameError = 'Username must be atleast 1 character, not start with a space or be all spaces or include a hyphen.'
        return res.render('register', {usernameError})
    } else if (password.length < 5) { // If password is less than 5 characters then return error
        const passwordError = 'Password must be atleast 5 characters'
        return res.render('register', {passwordError})
    } else {
        try {
            const existingUser = await User.findOne({ username: username }); 
            if (existingUser && existingUser.username == username) { // just so that they can't change capitalization and create an account with the same username
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

router.post('/add-friend', async (req, res) => {
    const username = jwt.verify(req.cookies.token, config.jwtSecret).username;
    const friendUsername = req.body.friend;
    try {
        const user = await User.findOne({ username });
        const friend = await User.findOne({ username: friendUsername });
        if (!user || !friend) return res.status(404).send();
        if (username === friendUsername) return res.status(400).send();
        if (friend.blocked && friend.blocked.includes(username)) return res.status(403).send(); // the user is blocked by the friend
        if (!friend.friends.includes(username) && !user.friends.includes(friendUsername) && !user.friendRequests.includes(friendUsername) && !friend.friendRequests.includes(username)) { // if the user is not already friends with the friend, the friend is not already friends with the user, the user has not already sent a friend request to the friend, and the friend has not already sent a friend request to the user
            friend.friendRequests.push(username);
            await friend.save();
            emitToUser(friendUsername, 'friend-request');
            return res.status(200).send();
        } else if (user.friendRequests.includes(friendUsername)) { // if the friend has already sent a friend request to the user, then accept the friend request
            user.friends.push(friendUsername);
            friend.friends.push(username);
            user.friendRequests = user.friendRequests.filter(f => f !== friendUsername);
            friend.friendRequests = friend.friendRequests.filter(f => f !== username);
            await user.save();
            await friend.save();
            emitToUser(friendUsername, 'refresh');
            emitToUser(username, 'refresh');
            return res.status(200).send();
        } else if (friend.friendRequests.includes(username)) {
            // do nothing
            return res.status(200).send();
        } else {
            return res.status(400).send();
        }
    } catch (err) {
        console.error(err)
        return res.status(500).send();
    }
});

router.post('/remove-friend', async (req, res) => {
    const username = jwt.verify(req.cookies.token, config.jwtSecret).username;
    const friendUsername = req.body.friend;
    try {
        const user = await User.findOne({ username });
        const friend = await User.findOne({ username: friendUsername });
        user.friends = user.friends.filter(f => f !== friendUsername);
        friend.friends = friend.friends.filter(f => f !== username);
        await user.save();
        await friend.save();
        emitToUser(friendUsername, 'refresh');
        return res.status(200).send();
    } catch (err) {
        console.error(err);
        return res.status(500).send();
    }
});

router.post('/friend-requests', async (req, res) => {
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
            emitToUser(friendUsername, 'refresh');
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
});

router.post('/blocked-users', async (req, res) => {
    const username = jwt.verify(req.cookies.token, config.jwtSecret).username;
    const blockedUser = req.body.user;
    try {
        const user = await User.findOne({ username });
        const blockedUsers = user.blocked || [];
        // this works as a toggle essentially, if the user is already blocked then it will unblock them and vice versa
        if (blockedUsers.includes(blockedUser)) {
            user.blocked = blockedUsers.filter(b => b !== blockedUser);
        } else {
            user.blocked.push(blockedUser);
            if (user.friends.includes(blockedUser)) { // if the user is friends with the blocked user, then remove them from the user's friends list
                user.friends = user.friends.filter(f => f !== blockedUser);
                const blockedFriend = await User.findOne({ username: blockedUser });
                blockedFriend.friends = blockedFriend.friends.filter(f => f !== username);
                await blockedFriend.save();
                emitToUser(blockedUser, 'refresh');
            }
        }
        await user.save();
        return res.status(200).send();
    } catch(err) {
        console.error(err);
        return res.status(500).send();
    }
});

router.post('/upload-profile-picture', async (req, res) => {
    const username = jwt.verify(req.cookies.token, config.jwtSecret).username;
    try {
        const profilePicture = req.files.profilePicture;
        if (!profilePicture) return res.status(400).send();
        if (profilePicture.mimetype !== 'image/png' && profilePicture.mimetype !== 'image/jpeg') return res.status(400).send();
        if (profilePicture.size > 5e6) return res.status(400).send(); // if the file is larger than 5MB
        const user = await User.findOne({ username });
        user.profilePicture = profilePicture;
        await user.save();
        return res.status(200).send();
    } catch (err) {
        console.error(err);
        return res.status(500).send();
    }
});

module.exports = router;