// Transaction.js
const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
    fromAddress: { type: String, required: true },
    fromAccountNumber: { type: String }, // NEW: To show sender alias on received txs
    toAddress: { type: String },         // NEW: The actual wallet that received funds
    toAccountNumber: { type: String, required: true },
    amount: { type: String, required: true },
    status: { type: String, default: 'pending' },
    taskId: { type: String },
    type: { type: String, default: 'transfer' }, // 'transfer', 'approve', etc.
    date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Transaction', TransactionSchema);