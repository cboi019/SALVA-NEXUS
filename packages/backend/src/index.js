require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer'); 
const { ethers } = require('ethers');
const { wallet, provider } = require('./services/walletSigner');
const { generateAndDeploySalvaIdentity } = require('./services/userService');
const { sponsorSafeTransfer } = require('./services/relayService');
const User = require('./models/User');
const Transaction = require('./models/Transaction');
const mongoose = require('mongoose');
const { Resend } = require('resend'); // UPDATED
const { GelatoRelay } = require("@gelatonetwork/relay-sdk"); // UPDATED

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

// Nodemailer Setup (Keeping this for compatibility/test, but using Resend for OTP)
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
// AUTH & EMAIL ROUTES (Updated with Resend)
// ===============================================

// 1. SEND OTP (Now via Resend)
app.post('/api/auth/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email required" });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[email] = {
    code: otp,
    expires: Date.now() + 600000 // 10 mins
  };

  try {
    // Using Resend for reliability
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
// REGISTRATION - Relayed via Gelato Gas Tank
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

    console.log("📝 Registering account on-chain via Gelato Gas Tank...");

    // Prepare Registration for Gelato Gas Tank
    const REGISTRY_ABI = ["function registerNumber(uint128,address)"];
    const iface = new ethers.Interface(REGISTRY_ABI);
    const data = iface.encodeFunctionData("registerNumber", [
      identityData.accountNumber,
      identityData.safeAddress
    ]);

    // Send Sponsored Call (Using GELATO_RELAY_API_KEY for Gas Tank)
    const relayRequest = {
      chainId: BigInt(process.env.CHAIN_ID || 84532), 
      target: process.env.REGISTRY_CONTRACT_ADDRESS,
      data: data
    };

    const relayResponse = await relay.sponsoredCall(
      relayRequest,
      process.env.GELATO_RELAY_API_KEY
    );

    console.log("✅ Gelato Task Created! Task ID:", relayResponse.taskId);

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
      taskId: relayResponse.taskId 
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
    const tokenContract = new ethers.Contract(process.env.NGN_TOKEN_ADDRESS, TOKEN_ABI, provider);
    const balanceWei = await tokenContract.balanceOf(address);
    const balance = ethers.formatUnits(balanceWei, 6);
    res.json({ balance });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch balance", balance: "0" });
  }
});

// ===============================================
// TRANSFER (Gelato-sponsored)
// ===============================================
app.post('/api/transfer', async (req, res) => {
  try {
    const { ownerKey, ownerPrivateKey, userPrivateKey, safeAddress, toInput, amount } = req.body;
    const signingKey = ownerKey || ownerPrivateKey || userPrivateKey;

    if (!signingKey || !safeAddress || !toInput || !amount) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const amountWei = ethers.parseUnits(amount.toString(), 6);
    const isAccountNumber = toInput.length <= 11 && !toInput.startsWith('0x');

    const result = await sponsorSafeTransfer(safeAddress, signingKey, toInput, amountWei, isAccountNumber);

    const newTransaction = new Transaction({
      fromAddress: safeAddress,
      toAccountNumber: toInput,
      amount: amount,
      status: 'successful',
      taskId: result.taskId,
      date: new Date()
    });
    await newTransaction.save();

    res.json({ success: true, message: "Transfer successful", taskId: result.taskId });
  } catch (error) {
    console.error("❌ Transfer failed:", error.message);
    try {
      const failedTx = new Transaction({
        fromAddress: req.body.safeAddress,
        toAccountNumber: req.body.toInput,
        amount: req.body.amount,
        status: 'failed',
        date: new Date()
      });
      await failedTx.save();
    } catch (dbError) {}
    res.status(500).json({ message: "Transfer failed", error: error.message });
  }
});

// ===============================================
// GET TRANSACTIONS
// ===============================================
app.get('/api/transactions/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const transactions = await Transaction.find({ fromAddress: address }).sort({ date: -1 }).limit(100);
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch transactions" });
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