const mongoose = require('mongoose');

const ApprovalSchema = new mongoose.Schema({
  owner: { type: String, required: true, index: true },   // The user's wallet address
  spender: { type: String, required: true },             // Who they authorized
  amount: { type: String, required: true },              // How much
  date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Approval', ApprovalSchema);