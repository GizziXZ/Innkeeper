const mongoose = require('mongoose');
const fs = require('fs');

const UsersSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    friends: {
        type: Array,
        required: false
    },
    friendRequests: {
        type: Array,
        required: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    publicKey: {
        type: String,
        required: false
    },
    pendingKeys: {
        type: Array,
        required: false
    },
    blocked: {
        type: Array,
        required: false
    },
    profilePicture: {
        type: Object,
        default: JSON.parse(fs.readFileSync('./models/default-image.json', 'utf8')) // base64 default image
    },
    status: {
        type: String,
        required: false
    }
});

const User = new mongoose.model("User", UsersSchema);

module.exports = User;