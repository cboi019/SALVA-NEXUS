// Salva-Digital-Tech/packages/backend/src/models/Transaction.js
const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
    fromAddress: { type: String, required: true },
    fromAccountNumber: { type: String },
    toAddress: { type: String },
    toAccountNumber: { type: String, required: true },
    senderDisplayIdentifier: { type: String }, // NEW: What receiver should see (sender's account# or address)
    executorAddress: { type: String }, // For transferFrom
    amount: { type: String, required: true },
    status: { type: String, default: 'pending' },
    taskId: { type: String },
    type: { type: String, default: 'transfer' },
    date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Transaction', TransactionSchema);