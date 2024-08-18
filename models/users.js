const mongoose = require('mongoose');

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
        default: '' // i'll add a default profile picture later
    },
    status: {
        type: String,
        required: false
    }
});

const User = new mongoose.model("User", UsersSchema);

module.exports = User;