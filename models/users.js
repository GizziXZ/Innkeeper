const mongoose = require('mongoose')

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
    online: {
        type: Boolean,
        required: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    publicKey: {
        type: String,
        required: false
    }
});

const User = new mongoose.model("User", UsersSchema);

module.exports = User;