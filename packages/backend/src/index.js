// index.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer'); 
const { ethers } = require('ethers');
const { wallet, provider } = require('./services/walletSigner');
const { generateAndDeploySalvaIdentity } = require('./services/userService');
const { sponsorSafeTransfer, sponsorSafeTransferFrom, sponsorSafeApprove } = require('./services/relayService');
const User = require('./models/User');
const Transaction = require('./models/Transaction');
const mongoose = require('mongoose');
const { Resend } = require('resend');
const { GelatoRelay } = require("@gelatonetwork/relay-sdk");
const Approval = require('./models/Approval');

// Initialize Resend and Gelato
const resend = new Resend(process.env.RESEND_API_KEY);
const relay = new GelatoRelay();

const app = express();
app.use(cors({
  origin: [
    'https://salva-nexus.onrender.com', 
    'http://localhost:3000'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
app.use(express.json());

// Temporary storage for OTPs
const otpStore = {};

// Nodemailer Setup
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, 
  connectionTimeout: 10000,
  auth: {
    user: process.env.EMAIL_USER || 'charlieonyii42@gmail.com',
    pass: process.env.EMAIL_PASS 
  }, 
  tls: {
    rejectUnauthorized: false 
  }
});

transporter.verify((error, success) => {
  if (error) {
    console.error("❌ Email System Error:", error.message);
  } else {
    console.log("📧 Email System: Ready to send OTPs");
  }
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('🍃 MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Connection Failed:', err));

// ===============================================
// AUTH & EMAIL ROUTES
// ===============================================

// 1. SEND OTP
app.post('/api/auth/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email required" });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[email] = {
    code: otp,
    expires: Date.now() + 600000
  };

  try {
    const data = await resend.emails.send({
      from: 'Salva <onboarding@resend.dev>',
      to: email,
      subject: "Verify your Salva Account",
      html: `
        <div style="background: #0A0A0B; color: white; padding: 40px; font-family: sans-serif; border-radius: 20px;">
          <h1 style="color: #D4AF37; margin-bottom: 20px;">SALVA</h1>
          <p style="font-size: 16px;">Use the verification code below:</p>
          <div style="background: #1A1A1B; padding: 20px; font-size: 32px; font-weight: bold; letter-spacing: 10px; text-align: center; color: #D4AF37; border: 1px solid #D4AF37; border-radius: 12px; margin: 20px 0;">
            ${otp}
          </div>
          <p style="opacity: 0.5; font-size: 12px;">This code expires in 10 minutes.</p>
        </div>
      `
    });
    console.log("📧 OTP sent successfully via Resend:", data.id);
    res.json({ message: 'OTP sent successfully' });
  } catch (err) {
    console.error("❌ RESEND FAIL:", err);
    res.status(500).json({ 
      message: 'Email service currently unavailable', 
      details: err.message 
    });
  }
});

// 2. VERIFY OTP
app.post('/api/auth/verify-otp', (req, res) => {
  const { email, code } = req.body;
  const record = otpStore[email];

  if (!record || record.code !== code || Date.now() > record.expires) {
    return res.status(400).json({ message: 'Invalid or expired code' });
  }

  record.verified = true; 
  res.json({ success: true });
});

// 3. RESET PASSWORD
app.post('/api/auth/reset-password', async (req, res) => {
  const { email, newPassword } = req.body;
  if (!otpStore[email] || !otpStore[email].verified) {
    return res.status(401).json({ message: "Unauthorized. Verify OTP first." });
  }
  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const user = await User.findOneAndUpdate(
      { email: email },
      { password: hashedPassword },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    delete otpStore[email];
    res.json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    res.status(500).json({ message: "Database update failed" });
  }
});

// ===============================================
// HELPER: Retry RPC Calls
// ===============================================
async function retryRPCCall(fn, maxRetries = 3, delay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      console.log(`⚠️ RPC call failed, retrying (${i + 1}/${maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1))); 
    }
  }
}

// ===============================================
// HELPER: Determine if input is Account Number or Address
// ===============================================
function isAccountNumber(input) {
  return !input.startsWith('0x') && input.length <= 15;
}

// ===============================================
// HELPER: Resolve User Data (Account Number or Address)
// ===============================================
async function resolveUser(input) {
  if (isAccountNumber(input)) {
    return await User.findOne({ accountNumber: input });
  } else {
    return await User.findOne({ safeAddress: input.toLowerCase() });
  }
}

// ===============================================
// REGISTRATION
// ===============================================
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    console.log("🚀 Generating Safe Wallet & Deploying...");
    const identityData = await generateAndDeploySalvaIdentity(process.env.BASE_SEPOLIA_RPC_URL);

    console.log("📝 Registering account via Backend Manager wallet...");
    
    const REGISTRY_ABI = ["function registerNumber(uint128,address)"];
    const registryContract = new ethers.Contract(
      process.env.REGISTRY_CONTRACT_ADDRESS,
      REGISTRY_ABI,
      wallet
    );

    const tx = await registryContract.registerNumber(
      identityData.accountNumber,
      identityData.safeAddress
    );
    
    console.log(`⏳ Registration TX sent: ${tx.hash}`);
    await tx.wait();
    console.log("✅ On-chain Registration Successful!");

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      safeAddress: identityData.safeAddress,
      accountNumber: identityData.accountNumber,
      ownerPrivateKey: identityData.ownerPrivateKey
    });

    await newUser.save();
    console.log("✅ User saved to database");

    res.json({
      username: newUser.username,
      safeAddress: newUser.safeAddress,
      accountNumber: newUser.accountNumber,
      ownerPrivateKey: newUser.ownerPrivateKey,
      registrationTx: tx.hash 
    });

  } catch (error) {
    console.error("❌ Registration failed:", error);
    res.status(500).json({ message: "Registration failed", error: error.message });
  }
});

// ===============================================
// LOGIN
// ===============================================
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

    res.json({
      username: user.username,
      safeAddress: user.safeAddress,
      accountNumber: user.accountNumber,
      ownerPrivateKey: user.ownerPrivateKey
    });
  } catch (error) {
    res.status(500).json({ message: "Login failed" });
  }
});

// ===============================================
// GET BALANCE
// ===============================================
app.get('/api/balance/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    const TOKEN_ABI = ["function balanceOf(address) view returns (uint256)"];
    const tokenContract = new ethers.Contract(
      process.env.NGN_TOKEN_ADDRESS, 
      TOKEN_ABI, 
      provider
    );

    const balanceWei = await retryRPCCall(async () => 
      await tokenContract.balanceOf(address)
    );

    const balance = ethers.formatUnits(balanceWei, 6);
    
    res.json({ balance });
  } catch (error) {
    console.error("❌ Balance Fetch Failed:", error.message);
    res.status(200).json({ balance: "0.00" });
  }
});

// ===============================================
// GET APPROVALS
// ===============================================
app.get('/api/approvals/:address', async (req, res) => {
  try {
    const ownerAddress = req.params.address;
    const savedApprovals = await Approval.find({ owner: ownerAddress.toLowerCase() });
    
    const TOKEN_ABI = ["function allowance(address,address) view returns (uint256)"];
    const tokenContract = new ethers.Contract(process.env.NGN_TOKEN_ADDRESS, TOKEN_ABI, provider);
    
    const liveApprovals = await Promise.all(savedApprovals.map(async (app) => {
      try {
        let spenderAddress = app.spender;
        if (!app.spender.startsWith('0x')) {
          const spenderUser = await User.findOne({ accountNumber: app.spender });
          if (!spenderUser) return app;
          spenderAddress = spenderUser.safeAddress;
        }
        const liveAllowanceWei = await tokenContract.allowance(ownerAddress, spenderAddress);
        const liveAmount = ethers.formatUnits(liveAllowanceWei, 6);
        
        if (parseFloat(liveAmount) <= 0) {
          await Approval.deleteOne({ _id: app._id });
          return null; 
        }

        if (liveAmount !== app.amount) {
          app.amount = liveAmount;
          await app.save();
        }
        return app;
      } catch (err) {
        console.error(`Allowance check failed for ${app.spender}:`, err.message);
        return app;
      }
    }));

    res.json(liveApprovals.filter(app => app !== null));
  } catch (error) {
    console.error("Critical Approval Route Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ===============================================
// TRANSFER (Fixed - saves what was typed for display)
// ===============================================
app.post('/api/transfer', async (req, res) => {
  try {
    const { userPrivateKey, safeAddress, toInput, amount } = req.body;
    const amountWei = ethers.parseUnits(amount.toString(), 6);

    // Resolve recipient to get their address (needed for blockchain)
    const recipient = await resolveUser(toInput);
    const recipientAddress = recipient ? recipient.safeAddress.toLowerCase() : (isAccountNumber(toInput) ? null : toInput.toLowerCase());

    if (!recipientAddress && isAccountNumber(toInput)) {
      return res.status(404).json({ message: "Recipient account number not found" });
    }

    // Execute blockchain transfer
    const result = await sponsorSafeTransfer(
      safeAddress, 
      userPrivateKey, 
      toInput, 
      amountWei
    );

    // Verify the transaction actually succeeded
    if (!result || !result.taskId) {
      console.error("❌ Transfer failed: No taskId returned");
      
      // Save as FAILED for sender only
      const sender = await User.findOne({ safeAddress: safeAddress.toLowerCase() });
      
      await new Transaction({
        fromAddress: safeAddress.toLowerCase(),
        fromAccountNumber: sender ? sender.accountNumber : null,
        toAddress: recipientAddress,
        toAccountNumber: toInput, // Save exactly what was typed
        amount: amount,
        status: 'failed',
        taskId: null,
        type: 'transfer',
        date: new Date()
      }).save();

      return res.status(400).json({ 
        success: false, 
        message: "Transfer failed on blockchain" 
      });
    }

    console.log("✅ Transfer successful with taskId:", result.taskId);

    // Save SUCCESSFUL transaction
    // KEY: toAccountNumber stores EXACTLY what the sender typed (account number OR address)
    // Get sender info for the transaction record
    const sender = await User.findOne({ safeAddress: safeAddress.toLowerCase() });
    
    await new Transaction({
      fromAddress: safeAddress.toLowerCase(),
      fromAccountNumber: sender ? sender.accountNumber : null,
      toAddress: recipientAddress,
      toAccountNumber: toInput, // This is what was typed - could be account number or address
      amount: amount,
      status: 'successful',
      taskId: result.taskId,
      type: 'transfer',
      date: new Date()
    }).save();

    res.json({ success: true, taskId: result.taskId });

  } catch (error) {
    console.error("❌ Transfer failed:", error.message);
    
    // Save as failed if exception occurs
    try {
      const sender = await User.findOne({ safeAddress: req.body.safeAddress.toLowerCase() });
      const recipient = await resolveUser(req.body.toInput);
      
      await new Transaction({
        fromAddress: req.body.safeAddress.toLowerCase(),
        fromAccountNumber: sender ? sender.accountNumber : null,
        toAddress: recipient ? recipient.safeAddress.toLowerCase() : (isAccountNumber(req.body.toInput) ? null : req.body.toInput.toLowerCase()),
        toAccountNumber: req.body.toInput, // Save what was typed
        amount: req.body.amount,
        status: 'failed',
        taskId: null,
        type: 'transfer',
        date: new Date()
      }).save();
    } catch (dbError) {
      console.error("Failed to save failed transaction:", dbError);
    }

    res.status(400).json({ 
      success: false, 
      message: "Transfer failed", 
      error: error.message 
    });
  }
});

// ===============================================
// APPROVE
// ===============================================
app.post('/api/approve', async (req, res) => {
  try {
    const { userPrivateKey, safeAddress, spenderInput, amount } = req.body;
    const amountWei = ethers.parseUnits(amount.toString(), 6);
    
    const result = await sponsorSafeApprove(safeAddress, userPrivateKey, spenderInput, amountWei);

    await Approval.findOneAndUpdate(
      { owner: safeAddress.toLowerCase(), spender: spenderInput.toLowerCase() },
      { amount: amount, date: new Date() },
      { upsert: true }
    );

    res.json({ success: true, taskId: result.taskId });
  } catch (error) {
    res.status(500).json({ message: "Approval failed", error: error.message });
  }
});

// ===============================================
// GET TRANSACTIONS (Fixed - shows what was originally typed)
// ===============================================
app.get('/api/transactions/:address', async (req, res) => {
  try {
    const address = req.params.address.toLowerCase();

    const transactions = await Transaction.find({
      $and: [
        { status: 'successful' },
        { 
          $or: [
            { fromAddress: address }, 
            { toAddress: address }
          ] 
        }
      ]
    }).sort({ date: -1 }).limit(50);

    const formatted = transactions.map(tx => {
      const isReceived = tx.toAddress?.toLowerCase() === address;
      
      // FIXED DISPLAY LOGIC:
      // Both sender and receiver should see what was originally typed
      // toAccountNumber contains exactly what was typed (account number OR address)
      
      return {
        ...tx._doc,
        displayType: isReceived ? 'receive' : 'sent',
        displayPartner: tx.toAccountNumber // Shows what was typed, whether account number or address
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error("❌ History Fetch Error:", error);
    res.status(500).json([]);
  }
});

// ===============================================
// TRANSFER FROM (Fixed - saves what was typed for display)
// ===============================================
app.post('/api/transferFrom', async (req, res) => {
  try {
    const { userPrivateKey, safeAddress, fromInput, toInput, amount } = req.body;
    const amountWei = ethers.parseUnits(amount.toString(), 6);

    // Resolve all parties
    const executor = await User.findOne({ safeAddress: safeAddress.toLowerCase() });
    const fromUser = await resolveUser(fromInput);
    const toUser = await resolveUser(toInput);

    if (!fromUser) {
      return res.status(404).json({ 
        success: false, 
        message: "Source account not found" 
      });
    }

    if (!toUser && isAccountNumber(toInput)) {
      return res.status(404).json({ 
        success: false, 
        message: "Destination account not found" 
      });
    }

    const fromAddress = fromUser.safeAddress.toLowerCase();
    const toAddress = toUser ? toUser.safeAddress.toLowerCase() : toInput.toLowerCase();

    // Execute transferFrom on blockchain
    const result = await sponsorSafeTransferFrom(
      userPrivateKey,
      safeAddress,
      fromInput,
      toInput,
      amountWei
    );

    // Verify success
    if (!result || !result.taskId) {
      console.error("❌ TransferFrom REVERTED: No taskId returned");
      return res.status(400).json({
        success: false, 
        message: "Transfer REVERTED: Check allowance or balance."
      });
    }

    console.log("✅ TransferFrom successful with taskId:", result.taskId);

    // Save SUCCESSFUL transaction
    // KEY INSIGHT: Store what the puller (destination) actually typed
    // - If they typed "1234567890" (account number), both histories show "1234567890"
    // - If they typed "0xabc..." (address), both histories show "0xabc..."
    await new Transaction({
      fromAddress: fromAddress,
      fromAccountNumber: fromUser.accountNumber,
      toAddress: toAddress,
      toAccountNumber: fromInput, // Store what the puller typed for the "from" field
      amount: amount,
      status: 'successful', 
      type: 'transferFrom',
      taskId: result.taskId,
      date: new Date()
    }).save();

    res.json({ success: true, taskId: result.taskId });

  } catch (error) {
    console.error("❌ TransferFrom failed:", error.message);
    // DO NOT SAVE TO DATABASE if it failed
    res.status(400).json({
      success: false, 
      message: "Transfer failed: Check allowance or balance.", 
      error: error.message 
    });
  }
});

// ===============================================
// GET GLOBAL STATS
// ===============================================
app.get('/api/stats', async (req, res) => {
  try {
    const citizenCount = await User.countDocuments();
    let totalSupply = '0';
    try {
      const TOKEN_ABI = ["function totalSupply() view returns (uint256)"];
      const tokenContract = new ethers.Contract(process.env.NGN_TOKEN_ADDRESS, TOKEN_ABI, provider);
      const supplyWei = await retryRPCCall(async () => await tokenContract.totalSupply());
      totalSupply = ethers.formatUnits(supplyWei, 6);
    } catch (rpcError) {
      totalSupply = '0';
    }
    res.json({ userCount: citizenCount.toString(), totalMinted: totalSupply });
  } catch (error) {
    res.status(200).json({ userCount: "0", totalMinted: "0" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 SALVA BACKEND ACTIVE ON PORT ${PORT}`);
});