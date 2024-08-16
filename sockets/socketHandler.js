const jwt = require('jsonwebtoken');
const { v4: uuid } = require('uuid');
const User = require('../models/users');
const config = require('../config.json');

const userSockets = {};

async function handleUserConnection(socket, io) { // when a user connects, update their online status and tell their friends that they are online
    try {
        const user = await User.findOne({ username: socket.username });
        const friends = user.friends;
        const onlineFriends = friends.filter(friend => userSockets[friend]);
        onlineFriends.forEach(friend => {
            const room = [socket.username, friend].sort().join('-');
            socket.join(room); // join a room with the user and their friend
            io.in(userSockets[friend]).emit('online', socket.username); // tell the online friends that the user is online
            io.in(userSockets[socket.username]).emit('online', friend); // tell the user that their online friends are online
        });
    } catch (err) {
        console.error(err);
    }
}

function initializeSocket(io) {
    io.on('connection', async (socket) => {
        try {
            socket.username = jwt.verify(socket.handshake.auth.token, config.jwtSecret).username;
            if (!socket.username) return socket.disconnect();
            userSockets[socket.username] = socket.id;
            handleUserConnection(socket, io);
            socket.on('pending-key', async (callback) => { // when a user connects they will ask for pending keys to update their chats
                try {
                    const user = await User.findOne({ username: socket.username });
                    callback(user.pendingKeys);
                    // delete the pending keys after sending them
                    user.pendingKeys = [];
                    await user.save();
                } catch (err) {
                    console.error(err);
                }
            });
            socket.on('disconnect', () => {
                delete userSockets[socket.username];
                setTimeout(async () => {
                    if (userSockets[socket.username]) return;
                    try {
                        const user = await User.findOne({ username: socket.username });
                        const onlineFriends = user.friends.filter(friend => userSockets[friend]);
                        onlineFriends.forEach(friend => io.to(userSockets[friend]).emit('offline', socket.username)); // tell the online friends that the user is offline
                    } catch (err) {
                        console.error(err);
                    }
                }, 1500);
            });
            socket.on('check-online', (user, callback) => {
                callback(!!userSockets[user]);
            });
            socket.on('save-public-key', async (publicKey) => {
                try {
                    const user = await User.findOne({ username: socket.username });
                    user.publicKey = publicKey;
                    await user.save();
                } catch (err) {
                    console.error(err);
                }
            });
            socket.on('request-public-key', async (username, callback) => {
                try {
                    const friend = await User.findOne({ username });
                    if (!friend.publicKey) return;
                    if (friend.friends.includes(socket.username)) return callback({ friend: username, publicKey: JSON.stringify(friend.publicKey) });
                } catch (err) {
                    console.error(err);
                    callback({ error: 'An error occurred while fetching the public key' });
                }
            });
            socket.on('save-symmetric-key', async (encrypted, recipient) => {
                try {
                    const friend = await User.findOne({ username: recipient });
                    if (friend.friends.includes(socket.username)) {
                        if (!userSockets[recipient]) {
                            if (!friend.pendingKeys) friend.pendingKeys = [];
                            const existingKeyIndex = friend.pendingKeys.findIndex(key => key.hasOwnProperty(socket.username)); // check if there is already a pending key from this user
                            if (existingKeyIndex !== -1) {
                                friend.pendingKeys.splice(existingKeyIndex, 1); // remove the key if it already exists to replace it
                            }
                            friend.pendingKeys.push({ [socket.username]: encrypted.toString('base64') }); // push the key
                            await friend.save();
                            return;
                        }
                        io.to(userSockets[recipient]).emit('save-symmetric-key', encrypted, socket.username); 
                    }
                } catch (err) {
                    console.error(err);
                }
            });
            socket.on('message', async (message, callback) => {
                try {
                    if (!message.recipient) return;
                    if (!message.text && !message.media) return;
                    const recipient = message.recipient;
                    if (recipient.includes('-')) { // if the recipient is a group chat (cheap yes i know)
                        const users = recipient.split('-');
                        if (!users.includes(socket.username)) return; // check if the sender is in the group chat
                        message.sender = socket.username;
                        io.to(recipient).emit('message', message);
                        callback(message);
                    } else {
                        message.sender = socket.username;
                        message.id = uuid();
                        const friend = await User.findOne({ username: recipient });
                        if (!friend.friends.includes(socket.username)) return;
                        const room = [socket.username, recipient].sort().join('-');
                        io.to(room).emit('message', message);
                        if ((await io.in(room).fetchSockets()).length < 2) {
                            return callback({ error: 'The recipient is offline', message });
                        }
                        callback(message);
                    }
                } catch (err) {
                    console.error(err);
                    callback({ error: 'An error occurred while sending the message', message });
                }
            });
            socket.on('create-groupchat', async (users, callback) => { // users is an object with the user + encrypted symmetric key (encrypted using their public key)
                try {
                    const usersArray = Object.keys(users);
                    if (usersArray.length < 2) return callback({ error: 'You need atleast 2 other users to create a group chat' });
                    // Check if all users are online
                    for (let i = 0; i < usersArray.length; i++) {
                        if (!userSockets[usersArray[i]]) {
                            return callback({ error: `User ${users[i]} is not online` });
                        }
                    }
                    usersArray.push(socket.username); // add the user to the group chat
                    const room = usersArray.sort().join('-');
                    usersArray.forEach(user => {if (user !== socket.username) io.to(userSockets[user]).emit('join-groupchat', room, {key: users[user]})}); // tell the users to join the group chat
                    callback(room);
                } catch (err) {
                    console.error(err);
                    callback({ error: 'An error occurred while creating the group chat' });
                }
            });
            socket.on('join-groupchat', async (room, callback) => { // we are not sending back the key because the client should already have it, if not that's on them and the gc will need to be recreated (this is on purpose for security)
                try {
                    const users = room.split('-'); // get the users in the group chat
                    if (!users.includes(socket.username)) return callback({ error: 'You are not in this group chat' }); // check if the user is in the group chat
                    socket.join(room); // actually join the socket room
                    callback({success: 'Joined the group chat'});
                } catch (err) {
                    console.error(err);
                    callback({ error: 'An error occurred while joining the group chat' });
                }
            });
            socket.on('leave-groupchat', (room, callback) => {
                try {
                    socket.leave(room);
                    callback({ success: 'Left the group chat' });
                } catch (err) {
                    console.error(err);
                    callback({ error: 'An error occurred while leaving the group chat' });
                }
            });
            let typingEventCounts = new Map();
            const maxEvents = 5;
            const timeWindow = 300;
            socket.on('typing', async (recipient) => {
                try {
                    if (recipient) {
                        const sender = socket.username;
                        if (!typingEventCounts.has(sender)) {
                            typingEventCounts.set(sender, 1);
                            setTimeout(() => typingEventCounts.delete(sender), timeWindow);
                        } else {
                            typingEventCounts.set(sender, typingEventCounts.get(sender) + 1);
                        }
                        if (typingEventCounts.get(sender) > maxEvents) return;
                        const isGroupChat = recipient.includes('-'); // i know, this is such a cheap way lol
                        if (isGroupChat) {
                            const users = recipient.split('-');
                            if (!users.includes(sender)) return; // check if the sender is in the group chat
                            io.to(recipient).emit('typing', sender);
                        } else {
                            const friend = await User.findOne({ username: recipient });
                            if (!friend.friends.includes(sender)) return;
                            const room = [socket.username, recipient].sort().join('-');
                            io.to(room).emit('typing', sender);
                        }
                    }
                } catch (err) {
                    console.error(err);
                }
            });
        } catch (err) {
            // usually an error here has to do with the socket initialization, we're ignoring expired token and invalid token errors 
            if (err instanceof jwt.TokenExpiredError || err instanceof jwt.JsonWebTokenError) return;
            console.error(err);
        }
    });
}

module.exports = initializeSocket;