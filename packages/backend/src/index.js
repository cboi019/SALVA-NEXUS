// index.js
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
// index.js

app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // 1. Generate and Deploy Safe (Backend pays gas)
    console.log("🚀 Generating Safe Wallet & Deploying...");
    const identityData = await generateAndDeploySalvaIdentity(process.env.BASE_SEPOLIA_RPC_URL);

    // 2. Register on-chain using the MANAGER wallet (NOT Gelato)
    console.log("📝 Registering account via Backend Manager wallet...");
    
    // We use the 'wallet' instance from your walletSigner.js (which uses MANAGER_PRIVATE_KEY)
    const REGISTRY_ABI = ["function registerNumber(uint128,address)"];
    const registryContract = new ethers.Contract(
      process.env.REGISTRY_CONTRACT_ADDRESS,
      REGISTRY_ABI,
      wallet // This is your backend signer
    );

    // Send direct transaction from backend
    const tx = await registryContract.registerNumber(
      identityData.accountNumber,
      identityData.safeAddress
    );
    
    console.log(`⏳ Registration TX sent: ${tx.hash}`);
    await tx.wait(); // Wait for 1 confirmation
    console.log("✅ On-chain Registration Successful!");

    // 3. Save to Database
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
    const tokenContract = new ethers.Contract(process.env.NGN_TOKEN_ADDRESS, TOKEN_ABI, provider);
    const balanceWei = await tokenContract.balanceOf(address);
    const balance = ethers.formatUnits(balanceWei, 6);
    res.json({ balance });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch balance", balance: "0" });
  }
});

// ===============================================
// GET ACTIVE APPROVALS (The missing link)
// ===============================================
app.get('/api/approvals/:address', async (req, res) => {
    try {
        const { address } = req.params;
        // ABI for the Approval event
        const TOKEN_ABI = ["event Approval(address indexed owner, address indexed spender, uint256 value)"];
        const tokenContract = new ethers.Contract(process.env.NGN_TOKEN_ADDRESS, TOKEN_ABI, provider);

        // We look for all Approval events where the current user is the 'owner'
        const filter = tokenContract.filters.Approval(address);
        
        // Query the last 5000 blocks for these events
        const events = await tokenContract.queryFilter(filter, -5000);

        // Create a map to keep only the latest allowance for each spender
        const latestApprovals = {};
        events.forEach(event => {
            const spender = event.args.spender;
            const amount = ethers.formatUnits(event.args.value, 6);
            latestApprovals[spender] = amount;
        });

        // Convert the map back to an array and filter out zero balances
        const formatted = Object.keys(latestApprovals).map(spender => ({
            spender,
            amount: latestApprovals[spender]
        })).filter(a => parseFloat(a.amount) > 0);

        res.json(formatted);
    } catch (error) {
        console.error("❌ Approval Fetch Error:", error);
        res.status(500).json([]);
    }
});

// ===============================================
// TRANSFER (Gelato-sponsored)
// ===============================================
// UPDATED TRANSFER ROUTE: Captures recipient address for bidirectional history
app.post('/api/transfer', async (req, res) => {
    try {
        const { userPrivateKey, safeAddress, toInput, amount } = req.body;
        const signingKey = userPrivateKey;
        const amountWei = ethers.parseUnits(amount.toString(), 6);
        const isAccountNumber = toInput.length <= 11 && !toInput.startsWith('0x');

        // Resolve recipient address for the database
        let resolvedTo = toInput;
        if (isAccountNumber) {
            const recipientUser = await User.findOne({ accountNumber: toInput });
            resolvedTo = recipientUser ? recipientUser.safeAddress : null;
        }

        const sender = await User.findOne({ safeAddress });

        const result = await sponsorSafeTransfer(safeAddress, signingKey, toInput, amountWei, isAccountNumber);

        const newTransaction = new Transaction({
            fromAddress: safeAddress,
            fromAccountNumber: sender ? sender.accountNumber : null,
            toAddress: resolvedTo,
            toAccountNumber: toInput,
            amount: amount,
            status: 'successful',
            taskId: result.taskId,
            date: new Date()
        });
        await newTransaction.save();

        res.json({ success: true, taskId: result.taskId });
    } catch (error) {
        res.status(500).json({ message: "Transfer failed", error: error.message });
    }
});

// ===============================================
// NEW: APPROVE ROUTE (Gasless via Gelato)
// ===============================================
app.post('/api/approve', async (req, res) => {
    try {
        const { userPrivateKey, safeAddress, spenderInput, amount } = req.body;
        const signingKey = userPrivateKey;
        const amountWei = ethers.parseUnits(amount.toString(), 6);
        
        // 1. Determine if spender is Account Number or Address
        const isAccountNumber = spenderInput.length <= 11 && !spenderInput.startsWith('0x');
        
        console.log(`Approving ${amount} NGNs for ${spenderInput}...`);

        // 2. Call the relay service (You will need to ensure sponsorSafeApprove exists in relayService.js)
        // We use the same pattern as transfer but targeting the 'approve' function
        const { sponsorSafeApprove } = require('./services/relayService'); 
        const result = await sponsorSafeApprove(
            safeAddress, 
            signingKey, 
            spenderInput, 
            amountWei, 
            isAccountNumber
        );

        // 3. Log the interaction (Optional: you can create a specific 'Approval' model if needed)
        res.json({ 
            success: true, 
            message: "Approval transaction relayed", 
            taskId: result.taskId 
        });
    } catch (error) {
        console.error("❌ Approval failed:", error);
        res.status(500).json({ message: "Approval failed", error: error.message });
    }
});

// ===============================================
// GET TRANSACTIONS
// ===============================================
// UPDATED: GET TRANSACTIONS (Now finds Sent AND Received)
app.get('/api/transactions/:address', async (req, res) => {
    try {
        const { address } = req.params;
        // Search for txs where user is sender OR receiver
        const transactions = await Transaction.find({
            $or: [
                { fromAddress: address },
                { toAddress: address }
            ]
        }).sort({ date: -1 }).limit(50);

        // Map to identify if it was 'sent' or 'received' for the UI
        const formatted = transactions.map(tx => {
            const isReceived = tx.toAddress?.toLowerCase() === address.toLowerCase();
            return {
                ...tx._doc,
                displayType: isReceived ? 'receive' : 'sent',
                displayPartner: isReceived ? (tx.fromAccountNumber || tx.fromAddress) : tx.toAccountNumber
            };
        });

        res.json(formatted);
    } catch (error) {
        res.status(500).json([]);
    }
});

// ===============================================
// NEW: TRANSFER FROM ROUTE (Gasless via Gelato)
// ===============================================
app.post('/api/transferFrom', async (req, res) => {
    try {
        const { userPrivateKey, safeAddress, fromInput, toInput, amount } = req.body;
        const signingKey = userPrivateKey;
        const amountWei = ethers.parseUnits(amount.toString(), 6);

        console.log(`Executing TransferFrom: Pulling ${amount} from ${fromInput} to ${toInput}`);

        // Call the relay service for transferFrom
        const { sponsorSafeTransferFrom } = require('./services/relayService');
        const result = await sponsorSafeTransferFrom(
            safeAddress,
            signingKey,
            fromInput,
            toInput,
            amountWei
        );

        // Resolve addresses for DB logging
        const fromUser = await User.findOne({ 
            $or: [{ safeAddress: fromInput }, { accountNumber: fromInput }] 
        });
        const toUser = await User.findOne({ 
            $or: [{ safeAddress: toInput }, { accountNumber: toInput }] 
        });

        // Save to Transaction History
        const newTransaction = new Transaction({
            fromAddress: fromUser ? fromUser.safeAddress : fromInput,
            fromAccountNumber: fromUser ? fromUser.accountNumber : null,
            toAddress: toUser ? toUser.safeAddress : toInput,
            toAccountNumber: toInput,
            amount: amount,
            status: 'successful',
            type: 'transferFrom',
            taskId: result.taskId,
            date: new Date()
        });
        await newTransaction.save();

        res.json({ success: true, taskId: result.taskId });
    } catch (error) {
        console.error("❌ TransferFrom failed:", error);
        res.status(500).json({ message: "TransferFrom failed", error: error.message });
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