const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
    fromAddress: { type: String, required: true },
    toAccountNumber: { type: String, required: true },
    amount: { type: String, required: true },
    status: { type: String, default: 'pending' },
    taskId: { type: String },
    date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Transaction', TransactionSchema);