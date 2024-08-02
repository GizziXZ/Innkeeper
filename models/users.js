const mongoose = require('mongoose')

const UsersSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true
    },
    tag: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
});

const User = new mongoose.model("User", UsersSchema);

module.exports = User;