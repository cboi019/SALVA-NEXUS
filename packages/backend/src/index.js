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
// HELPER: Check Gelato Task Status (REVERT DETECTION)
// ===============================================
async function checkGelatoTaskStatus(taskId, maxRetries = 20, delayMs = 2000) {
  console.log(`🔍 Polling Gelato task status for: ${taskId}`);
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const status = await relay.getTaskStatus(taskId);
      console.log(`📊 Task ${taskId} status:`, status.taskState);

      // SUCCESS STATES
      if (status.taskState === 'ExecSuccess') {
        console.log(`✅ Task ${taskId} SUCCEEDED on-chain`);
        return { success: true, status: 'successful' };
      }

      // FAILURE STATES
      if (status.taskState === 'ExecReverted') {
        console.error(`❌ Task ${taskId} REVERTED on-chain`);
        return { success: false, status: 'failed', reason: 'Transaction reverted on blockchain' };
      }

      if (status.taskState === 'Cancelled') {
        console.error(`❌ Task ${taskId} was CANCELLED`);
        return { success: false, status: 'failed', reason: 'Transaction cancelled' };
      }

      if (status.taskState === 'Blacklisted') {
        console.error(`❌ Task ${taskId} was BLACKLISTED`);
        return { success: false, status: 'failed', reason: 'Transaction blacklisted' };
      }

      // PENDING STATES - keep polling
      if (['CheckPending', 'ExecPending', 'WaitingForConfirmation'].includes(status.taskState)) {
        console.log(`⏳ Task ${taskId} still pending... (attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }

      // UNKNOWN STATE
      console.warn(`⚠️ Unknown task state: ${status.taskState}`);
      await new Promise(resolve => setTimeout(resolve, delayMs));

    } catch (error) {
      console.error(`❌ Error checking task status (attempt ${i + 1}):`, error.message);
      
      // If we can't check status after max retries, assume failure
      if (i === maxRetries - 1) {
        return { success: false, status: 'failed', reason: 'Could not verify transaction status' };
      }
      
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  // TIMEOUT
  console.error(`⏰ Task ${taskId} timed out after ${maxRetries} attempts`);
  return { success: false, status: 'failed', reason: 'Transaction verification timeout' };
}

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
// TRANSFER (Fixed with Revert Detection)
// ===============================================
app.post('/api/transfer', async (req, res) => {
  try {
    const { userPrivateKey, safeAddress, toInput, amount } = req.body;
    const amountWei = ethers.parseUnits(amount.toString(), 6);

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

    if (!result || !result.taskId) {
      console.error("❌ Transfer failed: No taskId returned");
      
      const sender = await User.findOne({ safeAddress: safeAddress.toLowerCase() });
      
      await new Transaction({
        fromAddress: safeAddress.toLowerCase(),
        fromAccountNumber: sender ? sender.accountNumber : null,
        toAddress: recipientAddress,
        toAccountNumber: toInput,
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

    console.log(`✅ Transfer submitted with taskId: ${result.taskId}`);

    // CRITICAL: Check if transaction actually succeeded on-chain
    const taskStatus = await checkGelatoTaskStatus(result.taskId);

    const sender = await User.findOne({ safeAddress: safeAddress.toLowerCase() });
    
    await new Transaction({
      fromAddress: safeAddress.toLowerCase(),
      fromAccountNumber: sender ? sender.accountNumber : null,
      toAddress: recipientAddress,
      toAccountNumber: toInput,
      amount: amount,
      status: taskStatus.status, // 'successful' or 'failed'
      taskId: result.taskId,
      type: 'transfer',
      date: new Date()
    }).save();

    if (!taskStatus.success) {
      return res.status(400).json({ 
        success: false, 
        message: taskStatus.reason || "Transfer reverted on blockchain"
      });
    }

    res.json({ success: true, taskId: result.taskId });

  } catch (error) {
    console.error("❌ Transfer failed:", error.message);
    
    try {
      const sender = await User.findOne({ safeAddress: req.body.safeAddress.toLowerCase() });
      const recipient = await resolveUser(req.body.toInput);
      
      await new Transaction({
        fromAddress: req.body.safeAddress.toLowerCase(),
        fromAccountNumber: sender ? sender.accountNumber : null,
        toAddress: recipient ? recipient.safeAddress.toLowerCase() : (isAccountNumber(req.body.toInput) ? null : req.body.toInput.toLowerCase()),
        toAccountNumber: req.body.toInput,
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
// APPROVE (Fixed with Revert Detection)
// ===============================================
app.post('/api/approve', async (req, res) => {
  try {
    const { userPrivateKey, safeAddress, spenderInput, amount } = req.body;
    const amountWei = ethers.parseUnits(amount.toString(), 6);
    
    const result = await sponsorSafeApprove(safeAddress, userPrivateKey, spenderInput, amountWei);

    if (!result || !result.taskId) {
      return res.status(400).json({ message: "Approval failed to submit" });
    }

    // Check if transaction actually succeeded
    const taskStatus = await checkGelatoTaskStatus(result.taskId);

    if (!taskStatus.success) {
      return res.status(400).json({ 
        success: false, 
        message: taskStatus.reason || "Approval reverted on blockchain"
      });
    }

    await Approval.findOneAndUpdate(
      { owner: safeAddress.toLowerCase(), spender: spenderInput.toLowerCase() },
      { amount: amount, date: new Date() },
      { upsert: true }
    );

    console.log("✅ APPROVAL SAVED:", {
      owner: safeAddress.toLowerCase(),
      spender: spenderInput.toLowerCase(),
      amount: amount
    });

    res.json({ success: true, taskId: result.taskId });
  } catch (error) {
    res.status(500).json({ message: "Approval failed", error: error.message });
  }
});

// ===============================================
// GET TRANSACTIONS
// ===============================================
app.get('/api/transactions/:address', async (req, res) => {
  try {
    const address = req.params.address.toLowerCase();

    // Show BOTH successful AND failed transactions
    const transactions = await Transaction.find({
      $or: [
        { fromAddress: address }, 
        { toAddress: address }
      ]
    }).sort({ date: -1 }).limit(50);

    const formatted = transactions.map(tx => {
      const isReceived = tx.toAddress?.toLowerCase() === address;
      
      return {
        ...tx._doc,
        displayType: isReceived ? 'receive' : 'sent',
        displayPartner: tx.toAccountNumber
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error("❌ History Fetch Error:", error);
    res.status(500).json([]);
  }
});

// ===============================================
// TRANSFER FROM (Fixed with Revert Detection)
// ===============================================
app.post('/api/transferFrom', async (req, res) => {
  try {
    const { userPrivateKey, safeAddress, fromInput, toInput, amount } = req.body;
    const amountWei = ethers.parseUnits(amount.toString(), 6);

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

    const result = await sponsorSafeTransferFrom(
      userPrivateKey,
      safeAddress,
      fromInput,
      toInput,
      amountWei
    );

    if (!result || !result.taskId) {
      console.error("❌ TransferFrom failed: No taskId returned");
      return res.status(400).json({
        success: false, 
        message: "Transfer failed to submit"
      });
    }

    console.log(`✅ TransferFrom submitted with taskId: ${result.taskId}`);

    // CRITICAL: Check if transaction actually succeeded on-chain
    const taskStatus = await checkGelatoTaskStatus(result.taskId);

    if (!taskStatus.success) {
      // DO NOT SAVE TO DATABASE if it failed
      return res.status(400).json({
        success: false, 
        message: taskStatus.reason || "Transfer reverted: Check allowance or balance"
      });
    }

    // Only save if successful
    await new Transaction({
      fromAddress: fromAddress,
      fromAccountNumber: fromUser.accountNumber,
      toAddress: toAddress,
      toAccountNumber: fromInput,
      amount: amount,
      status: 'successful', 
      type: 'transferFrom',
      taskId: result.taskId,
      date: new Date()
    }).save();

    res.json({ success: true, taskId: result.taskId });

  } catch (error) {
    console.error("❌ TransferFrom failed:", error.message);
    res.status(400).json({
      success: false, 
      message: "Transfer failed", 
      error: error.message 
    });
  }
});


// FIXED: Get incoming allowances - checks BOTH address and account number
app.get('/api/allowances-for/:address', async (req, res) => {
  try {
    const userAddress = req.params.address.toLowerCase();
    
    // Find the user to get their account number
    const currentUser = await User.findOne({ safeAddress: userAddress });
    if (!currentUser) {
      return res.json([]);
    }

    // Find approvals where the spender is EITHER the user's address OR account number
    const savedAllowances = await Approval.find({
      $or: [
        { spender: userAddress },
        { spender: currentUser.accountNumber }
      ]
    });
    
    const TOKEN_ABI = ["function allowance(address,address) view returns (uint256)"];
    const tokenContract = new ethers.Contract(process.env.NGN_TOKEN_ADDRESS, TOKEN_ABI, provider);
    
    const liveAllowances = await Promise.all(savedAllowances.map(async (app) => {
      try {
        let ownerAddress = app.owner;
        
        // If owner is account number, resolve to address
        if (!app.owner.startsWith('0x')) {
          const ownerUser = await User.findOne({ accountNumber: app.owner });
          if (!ownerUser) return null;
          ownerAddress = ownerUser.safeAddress;
        }
        
        // CHECK LIVE ON-CHAIN ALLOWANCE
        const liveAllowanceWei = await tokenContract.allowance(ownerAddress, userAddress);
        const liveAmount = ethers.formatUnits(liveAllowanceWei, 6);
        
        // DELETE FROM DB IF ALLOWANCE IS ZERO
        if (parseFloat(liveAmount) <= 0) {
          await Approval.deleteOne({ _id: app._id });
          return null;
        }

        // UPDATE DB IF AMOUNT CHANGED
        if (liveAmount !== app.amount) {
          app.amount = liveAmount;
          await app.save();
        }
        
        return {
          allower: app.owner, // Return what was originally stored (account number or address)
          amount: app.amount,
          date: app.date
        };
      } catch (err) {
        console.error(`Allowance check failed for ${app.owner}:`, err.message);
        return {
          allower: app.owner,
          amount: app.amount,
          date: app.date
        };
      }
    }));

    res.json(liveAllowances.filter(app => app !== null));
  } catch (error) {
    console.error("Critical Incoming Allowance Route Error:", error);
    res.status(500).json({ error: error.message });
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