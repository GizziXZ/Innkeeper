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
                const user = await User.findOne({ username: socket.username });
                callback(user.pendingKeys);
                // delete the pending keys after sending them
                user.pendingKeys = [];
                await user.save();
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
                            friend.pendingKeys.splice(existingKeyIndex, 1); // remove the key if it already exists to replace it
                        }
                        friend.pendingKeys.push({ [socket.username]: encrypted.toString('base64') }); // push the key
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
            socket.on('create-groupchat', async (users, callback) => { // users is an object with the user + encrypted symmetric key (encrypted using their public key)
                if (Object.keys(users).length <= 2) return callback({ error: 'You need atleast 2 other users to create a group chat' });
                if (io.sockets.adapter.rooms.get(users.sort().join('-'))) return callback({ error: 'Group chat already exists' }); // REVIEW this line (this might not be how you check if a room exists)
                // Check if all users are online
                for (let i = 0; i < Object.keys(users).length; i++) {
                    if (!userSockets[users[i]]) {
                        return callback({ error: `User ${users[i]} is not online` });
                    }
                }
                users.push(socket.username); // add the user to the group chat
                const room = users.sort().join('-');
                users.forEach(user => io.to(userSockets[user]).emit('join-groupchat', {room, key: users[user]})); // tell the users to join the group chat
                callback(room); // response ok to the client
            });
            socket.on('join-groupchat', async (room, callback) => {
                const users = room.split('-'); // get the users in the group chat
                if (!users.includes(socket.username)) return callback({ error: 'You are not in this group chat' }); // check if the user is in the group chat
                socket.join(room); // actually join the socket room
                callback(room); // response ok to the client
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