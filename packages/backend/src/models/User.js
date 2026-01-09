// User.js 
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    email: { 
        type: String, 
        required: true, 
        unique: true,
        lowercase: true,
        trim: true,
        index: true
    },
    username: { 
        type: String, 
        required: true, 
        unique: true,
        trim: true,
        index: true
    },
    password: { 
        type: String, 
        required: true 
    },
    safeAddress: { 
        type: String, 
        required: true,
        unique: true,
        index: true
    },
    accountNumber: { 
        type: String, 
        required: true, 
        unique: true,
        index: true
    },
    ownerPrivateKey: { 
        type: String, 
        required: true 
    },
    createdAt: { 
        type: Date, 
        default: Date.now,
        index: true
    }
});

module.exports = mongoose.model('User', UserSchema);