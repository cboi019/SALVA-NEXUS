// Salva-Digital-Tech/Packages/backend/src/models/User.js
const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true,
  },
  password: {
    type: String,
    required: true,
  },
  safeAddress: {
    type: String,
    required: true,
    unique: true,
    index: true,
    lowercase: true, // ✅ ADD THIS
    set: (v) => v.toLowerCase(), // ✅ ADD THIS
  },
  accountNumber: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  ownerPrivateKey: {
    type: String,
    required: true,
  },
  // NEW FIELDS FOR TRANSACTION PIN SYSTEM
  transactionPin: {
    type: String,
    default: null, // null = no PIN set yet
  },
  accountLockedUntil: {
    type: Date,
    default: null, // null = not locked
  },
  pinSetupCompleted: {
    type: Boolean,
    default: false, // Track if user completed initial PIN setup
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

module.exports = mongoose.model("User", UserSchema);
