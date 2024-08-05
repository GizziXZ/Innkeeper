const mongoose = require('mongoose')

const UsersSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true
    },
    discriminator: {
        type: String,
        required: false //NOTE - change to true later once we have a tag system
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
});

const User = new mongoose.model("User", UsersSchema);

module.exports = User;