require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer'); // FIXED: Defined the missing nodemailer
const { ethers } = require('ethers');
const { wallet, provider } = require('./services/walletSigner');
const { generateAndDeploySalvaIdentity } = require('./services/userService');
const { sponsorSafeTransfer } = require('./services/relayService');
const User = require('./models/User');
const Transaction = require('./models/Transaction');
const mongoose = require('mongoose');

const app = express();
app.use(cors({
  origin: [
    'https://salva-nexus.onrender.com', // Your Render Frontend URL
    'http://localhost:3000'             // For local testing
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
app.use(express.json());

// Temporary storage for OTPs (Email -> {code, expires})
const otpStore = {};

// Nodemailer Setup
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true, // Use SSL/TLS
  auth: {
    user: process.env.EMAIL_USER || 'charlieonyii42@gmail.com',
    pass: process.env.EMAIL_PASS 
  }
});

// --- NEW: Connection Test ---
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ Email System Error:", error.message);
    console.log("👉 Check: Did you add the 16-digit App Password to your Environment Variables?");
  } else {
    console.log("📧 Email System: Ready to send OTPs");
  }
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('🍃 MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Connection Failed:', err));

// ===============================================
// AUTH & EMAIL ROUTES (New)
// ===============================================

// 1. SEND OTP
app.post('/api/auth/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email required" });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[email] = {
    code: otp,
    expires: Date.now() + 600000 // 10 mins
  };

  try {
    await transporter.sendMail({
      from: `"Salva Nexus" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Verify your Salva Account",
      html: `
        <div style="background: #0A0A0B; color: white; padding: 40px; font-family: sans-serif; border-radius: 20px;">
          <h1 style="color: #D4AF37; margin-bottom: 20px;">SALVA</h1>
          <p style="font-size: 16px;">Use the verification code below:</p>
          <div style="background: #1A1A1B; padding: 20px; font-size: 32px; font-weight: bold; letter-spacing: 10px; text-align: center; color: #D4AF37; border: 1px solid #D4AF37; border-radius: 12px; margin: 20px 0;">
            ${otp}
          </div>
          <p style="opacity: 0.5; font-size: 12px;">This code expires in 10 minutes. If you didn't request this, please ignore.</p>
        </div>
      `
    });
    console.log(`📧 OTP sent to ${email}`);
    res.json({ message: 'OTP sent successfully' });
  } catch (err) {
    console.error("❌ Email Error:", err);
    res.status(500).json({ message: 'Error sending email' });
  }
});

// 2. VERIFY OTP
app.post('/api/auth/verify-otp', (req, res) => {
  const { email, code } = req.body;
  const record = otpStore[email];

  if (!record || record.code !== code || Date.now() > record.expires) {
    return res.status(400).json({ message: 'Invalid or expired code' });
  }

  // We don't delete yet if we need it for the next step (Reset Password)
  // But for Registration, we can flag it as verified
  record.verified = true; 
  res.json({ success: true });
});

// 3. RESET PASSWORD (The DB Update)
app.post('/api/auth/reset-password', async (req, res) => {
  const { email, newPassword } = req.body;
  
  // Security check: ensure they actually verified the OTP first
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

    delete otpStore[email]; // Success, clear the OTP
    console.log(`🔐 Password reset for ${email}`);
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
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1))); // Exponential backoff
    }
  }
}

// ===============================================
// REGISTRATION - Deploy Safe + Register Number
// ===============================================
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    console.log("🚀 Generating Safe Wallet & Deploying...");
    
    // FIXED: Renamed variable to identityData to prevent the "already declared" SyntaxError
    const identityData = await generateAndDeploySalvaIdentity(process.env.BASE_SEPOLIA_RPC_URL);

    console.log("📝 Registering account number on-chain...");
    
    // Register account number in Registry (backend pays gas)
    const REGISTRY_ABI = ["function registerNumber(uint128,address)"];
    const registryContract = new ethers.Contract(
      process.env.REGISTRY_CONTRACT_ADDRESS,
      REGISTRY_ABI,
      wallet
    );

    const registerTx = await registryContract.registerNumber(
      identityData.accountNumber,
      identityData.safeAddress
    );
    await registerTx.wait();
    console.log("✅ Account registered on-chain! TX:", registerTx.hash);

    // Hash password and save user
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
      ownerPrivateKey: newUser.ownerPrivateKey
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
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    res.json({
      username: user.username,
      safeAddress: user.safeAddress,
      accountNumber: user.accountNumber,
      ownerPrivateKey: user.ownerPrivateKey
    });

  } catch (error) {
    console.error("❌ Login failed:", error);
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

    const balanceWei = await tokenContract.balanceOf(address);
    const balance = ethers.formatUnits(balanceWei, 6); // NGNs has 6 decimals

    res.json({ balance });
  } catch (error) {
    console.error("❌ Balance fetch failed:", error);
    res.status(500).json({ message: "Failed to fetch balance", balance: "0" });
  }
});

// ===============================================
// TRANSFER (Gelato-sponsored)
// ===============================================
app.post('/api/transfer', async (req, res) => {
  try {
    // UPDATED: Destructure all possible variations of the private key name
    const { 
      ownerKey, 
      ownerPrivateKey, 
      userPrivateKey, 
      safeAddress, 
      toInput, 
      amount 
    } = req.body;
    
    // FIX: Pick the first one that isn't undefined
    const signingKey = ownerKey || ownerPrivateKey || userPrivateKey;

    console.log("🔍 Transfer Request Received:", { 
      safeAddress, 
      toInput, 
      amount, 
      hasKey: !!signingKey
    });

    // Validate inputs - updated to check the consolidated signingKey
    if (!signingKey || !safeAddress || !toInput || !amount) {
      console.log("⚠️ Validation Failed. Missing:", {
        hasKey: !!signingKey,
        hasSafe: !!safeAddress,
        hasTo: !!toInput,
        hasAmount: !!amount
      });
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Convert amount to wei (6 decimals for NGNs)
    const amountWei = ethers.parseUnits(amount.toString(), 6);

    // FLEXIBLE DETECTION LOGIC
    const isAccountNumber = toInput.length <= 11 && !toInput.startsWith('0x');
    
    console.log(isAccountNumber 
      ? `📞 Detected Account Number: ${toInput}` 
      : `🔗 Detected Wallet Address: ${toInput}`
    );

    console.log("💸 Initiating Gelato-sponsored transfer...");

    // Execute transfer via Gelato 
    const result = await sponsorSafeTransfer(
      safeAddress,
      signingKey,
      toInput,
      amountWei,
      isAccountNumber 
    );

    console.log("✅ Transfer successful! Task ID:", result.taskId);

    // Save transaction to database
    const newTransaction = new Transaction({
      fromAddress: safeAddress,
      toAccountNumber: toInput,
      amount: amount,
      status: 'successful',
      taskId: result.taskId,
      date: new Date()
    });

    await newTransaction.save();

    res.json({ 
      success: true, 
      message: "Transfer successful",
      taskId: result.taskId
    });

  } catch (error) {
    console.error("❌ Transfer failed:", error.message);
    
    // Save failed transaction for history
    try {
      const failedTx = new Transaction({
        fromAddress: req.body.safeAddress,
        toAccountNumber: req.body.toInput,
        amount: req.body.amount,
        status: 'failed',
        date: new Date()
      });
      await failedTx.save();
    } catch (dbError) {
      console.error("❌ Failed to save failed transaction record:", dbError);
    }

    res.status(500).json({ 
      message: "Transfer failed", 
      error: error.message 
    });
  }
});

// ===============================================
// GET TRANSACTIONS
// ===============================================
app.get('/api/transactions/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    const transactions = await Transaction.find({ fromAddress: address })
      .sort({ date: -1 })
      .limit(100);

    res.json(transactions);
  } catch (error) {
    console.error("❌ Transaction fetch failed:", error);
    res.status(500).json({ message: "Failed to fetch transactions", error: error.message });
  }
});

// ===============================================
// GET GLOBAL STATS (For Landing Page)
// ===============================================
app.get('/api/stats', async (req, res) => {
  try {
    console.log("📊 Stats Request Received...");
    
    // 1. Get user count from MongoDB (this usually works fine)
    const citizenCount = await User.countDocuments();
    console.log(`👥 DB Citizens: ${citizenCount}`);

    // 2. Get blockchain supply with retry logic
    let totalSupply = '0';
    
    try {
      const TOKEN_ABI = ["function totalSupply() view returns (uint256)"];
      const tokenContract = new ethers.Contract(
        process.env.NGN_TOKEN_ADDRESS,
        TOKEN_ABI,
        provider
      );

      // Use retry helper for the blockchain call
      const supplyWei = await retryRPCCall(async () => {
        return await tokenContract.totalSupply();
      }, 3, 500); // 3 retries with 500ms initial delay
      
      totalSupply = ethers.formatUnits(supplyWei, 6);
      console.log(`💰 Blockchain Supply: ${totalSupply}`);
      
    } catch (rpcError) {
      // If blockchain call fails after retries, log but don't crash
      console.error("⚠️ Blockchain query failed after retries:", rpcError.message);
      // Return last known value or 0 - the app continues working
      totalSupply = '0';
    }

    // Always return a response, even if blockchain call failed
    res.json({
      userCount: citizenCount.toString(),
      totalMinted: totalSupply
    });
    
  } catch (error) {
    console.error("❌ Stats Route Error:", error.message);
    // Return default values instead of crashing
    res.status(200).json({ userCount: "0", totalMinted: "0" });
  }
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 SALVA BACKEND ACTIVE ON PORT ${PORT}`);
});

/*


*/