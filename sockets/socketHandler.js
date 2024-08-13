// sockets/socketHandler.js
const jwt = require('jsonwebtoken');
const { v4: uuid } = require('uuid');
const User = require('../models/users');
const config = require('../config.json');

const userSockets = {};

async function handleUserConnection(socket, io) { // when a user connects, update their online status and tell their friends that they are online
    const user = await User.findOne({ username: socket.username });
    user.online = true;
    await user.save();
    const friends = user.friends;
    const onlineFriends = friends.filter(friend => userSockets[friend]);
    onlineFriends.forEach(friend => {
        const room = [socket.username, friend].sort().join('-');
        socket.join(room); // join a room with the user and their friend
        io.in(userSockets[friend]).emit('online', socket.username); // tell the online friends that the user is online
        io.in(userSockets[socket.username]).emit('online', friend); // tell the user that their online friends are online
    });
}

function initializeSocket(io) {
    io.on('connection', async (socket) => {
        try {
            socket.username = jwt.verify(socket.handshake.auth.token, config.jwtSecret).username;
            if (!socket.username) return socket.disconnect();
            userSockets[socket.username] = socket.id;
            handleUserConnection(socket, io);
            socket.on('pending-key', async (callback) => { // when a user connects they will ask for pending keys to update their chats
                const pendingKeys = (await User.findOne({ username: socket.username })).pendingKeys;
                callback(pendingKeys);
                // delete the pending keys after sending them
            })
            socket.on('disconnect', () => {
                delete userSockets[socket.username];
                setTimeout(async () => {
                    if (userSockets[socket.username]) return;
                    const user = await User.findOne({ username: socket.username });
                    user.online = false;
                    await user.save();
                    const onlineFriends = user.friends.filter(friend => userSockets[friend]);
                    onlineFriends.forEach(friend => io.to(userSockets[friend]).emit('offline', socket.username)); // tell the online friends that the user is offline
                }, 1500);
            });
            socket.on('save-public-key', async (publicKey) => {
                const user = await User.findOne({ username: socket.username });
                user.publicKey = publicKey;
                await user.save();
            });
            socket.on('request-public-key', async (username) => {
                const friend = await User.findOne({ username });
                if (!friend.publicKey) return;
                if (friend.friends.includes(socket.username)) {
                    return io.to(userSockets[socket.username]).emit('public-key', { friend: username, publicKey: JSON.stringify(friend.publicKey) });
                }
            });
            socket.on('save-symmetric-key', async (encrypted, recipient) => {
                const friend = await User.findOne({ username: recipient });
                if (friend.friends.includes(socket.username)) {
                    if (!userSockets[recipient]) {
                        if (!friend.pendingKeys) friend.pendingKeys = [];
                        const existingKeyIndex = friend.pendingKeys.findIndex(key => key.hasOwnProperty(socket.username)); // check if there is already a pending key from this user
                        if (existingKeyIndex !== -1) {
                            friend.pendingKeys[existingKeyIndex][socket.username] = encrypted.toString('base64'); // update the key if it already exists
                        } else {
                            friend.pendingKeys.push({ [socket.username]: encrypted.toString('base64') }); // push the key if it doesn't exist
                        }
                        // console.log(friend.pendingKeys);
                        await friend.save();
                        return;
                    }
                    io.to(userSockets[recipient]).emit('save-symmetric-key', encrypted, socket.username);
                }
            });
            socket.on('message', async (message, callback) => {
                if (!message.recipient) return;
                if (!message.text && !message.media) return;
                const recipient = message.recipient;
                if (recipient) {
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
            });
            let typingEventCounts = new Map();
            const maxEvents = 5;
            const timeWindow = 300;
            socket.on('typing', async (recipient) => {
                if (recipient) {
                    const sender = socket.username;
                    if (!typingEventCounts.has(sender)) {
                        typingEventCounts.set(sender, 1);
                        setTimeout(() => typingEventCounts.delete(sender), timeWindow);
                    } else {
                        typingEventCounts.set(sender, typingEventCounts.get(sender) + 1);
                    }
                    if (typingEventCounts.get(sender) > maxEvents) return;
                    const friend = await User.findOne({ username: recipient });
                    if (!friend.friends.includes(sender)) return;
                    const room = [socket.username, recipient].sort().join('-');
                    io.to(room).emit('typing', sender);
                }
            });
        } catch (err) {
            if (err instanceof jwt.TokenExpiredError) return;
            console.error(err);
        }
    });
}

module.exports = initializeSocket;