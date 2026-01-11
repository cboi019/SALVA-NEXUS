// index.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer'); 
const { ethers } = require('ethers');
const { wallet, provider } = require('./services/walletSigner');
const { generateAndDeploySalvaIdentity } = require('./services/userService');
const { sponsorSafeTransfer, sponsorSafeTransferFrom } = require('./services/relayService');
const User = require('./models/User');
const Transaction = require('./models/Transaction');
const mongoose = require('mongoose');
const { Resend } = require('resend'); // UPDATED
const { GelatoRelay } = require("@gelatonetwork/relay-sdk"); // UPDATED
const Approval = require('./models/Approval'); // Import the model at the top

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
    
    // 1. ABI for checking balance
    const TOKEN_ABI = ["function balanceOf(address) view returns (uint256)"];
    const tokenContract = new ethers.Contract(
      process.env.NGN_TOKEN_ADDRESS, 
      TOKEN_ABI, 
      provider
    );

    // 2. Fetch balance using your helper to prevent RPC blips
    const balanceWei = await retryRPCCall(async () => 
      await tokenContract.balanceOf(address)
    );

    // 3. Format units (Using 6 decimals as per your other routes)
    const balance = ethers.formatUnits(balanceWei, 6);
    
    res.json({ balance });
  } catch (error) {
    console.error("❌ Balance Fetch Failed:", error.message);
    // Return 0 so the UI doesn't crash, but log the error
    res.status(200).json({ balance: "0.00" });
  }
});

app.get('/api/approvals/:address', async (req, res) => {
    try {
        const ownerAddress = req.params.address;
        const savedApprovals = await Approval.find({ owner: ownerAddress.toLowerCase() });
        
        // Define the contract inside the route so it's always available
        const TOKEN_ABI = ["function allowance(address,address) view returns (uint256)"];
        const tokenContract = new ethers.Contract(process.env.NGN_TOKEN_ADDRESS, TOKEN_ABI, provider);
        
        // Map through saved spenders and get their LIVE blockchain allowance
        const liveApprovals = await Promise.all(savedApprovals.map(async (app) => {
            try {
                // 1. RESOLVE: Check if 'app.spender' is an Account Number or Address
                let spenderAddress = app.spender;
                if (!app.spender.startsWith('0x')) {
                    const spenderUser = await User.findOne({ accountNumber: app.spender });
                    if (!spenderUser) return app; // Skip if user not found
                     spenderAddress = spenderUser.safeAddress;
                }
                const liveAllowanceWei = await tokenContract.allowance(ownerAddress, spenderAddress);
                const liveAmount = ethers.formatUnits(liveAllowanceWei, 6);
                
                if (parseFloat(liveAmount) <= 0) {
                    // THE TRUTH: If it's 0, wipe it from the DB entirely
                    await Approval.deleteOne({ _id: app._id });
                    return null; 
                }

                // Sync the database if the spender has used some funds
                if (liveAmount !== app.amount) {
                    app.amount = liveAmount;
                    await app.save();
                }
                return app;
            } catch (err) {
                console.error(`Allowance check failed for ${app.spender}:`, err.message);
                return app; // Fallback to DB version if RPC fails
            }
        }));

        // Only return spenders who still have a balance > 0
        res.json(liveApprovals.filter(app => app !== null));
    } catch (error) {
        console.error("Critical Approval Route Error:", error);
        res.status(500).json({ error: error.message });
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
        const amountWei = ethers.parseUnits(amount.toString(), 6);
        
        // 1. Send to Blockchain
        const { sponsorSafeApprove } = require('./services/relayService'); 
        const result = await sponsorSafeApprove(safeAddress, userPrivateKey, spenderInput, amountWei, false);

        // 2. Save to your MongoDB (So the dashboard can see it instantly)
        await Approval.findOneAndUpdate(
            { owner: safeAddress.toLowerCase(), spender: spenderInput.toLowerCase() },
            { amount: amount, date: new Date() },
            { upsert: true } // Create if doesn't exist, update if it does
        );

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
        // 1. Normalize the incoming address to lowercase
        const address = req.params.address.toLowerCase();

        // 2. Search for successful transactions where the user is EITHER sender or receiver
        const transactions = await Transaction.find({
            $and: [
                { status: 'successful' }, // Ensure we only show confirmed ones
                { 
                    $or: [
                        { fromAddress: address }, 
                        { toAddress: address }
                    ] 
                }
            ]
        }).sort({ date: -1 }).limit(50);

        // 3. Format for the UI
        const formatted = transactions.map(tx => {
            const isReceived = tx.toAddress?.toLowerCase() === address;
            return {
                ...tx._doc,
                displayType: isReceived ? 'receive' : 'sent',
                // Fallback to address if account number isn't in the DB
                displayPartner: isReceived 
                    ? (tx.fromAccountNumber || tx.fromAddress) 
                    : (tx.toAccountNumber || tx.toAddress)
            };
        });

        res.json(formatted);
    } catch (error) {
        console.error("❌ History Fetch Error:", error);
        res.status(500).json([]);
    }
});

// ===============================================
// NEW: TRANSFER FROM ROUTE (Gasless via Gelato)
// ===============================================
app.post('/api/transferFrom', async (req, res) => {
    try {
        const { userPrivateKey, safeAddress, fromInput, toInput, amount } = req.body;
        const amountWei = ethers.parseUnits(amount.toString(), 6);

        // 1. EXECUTE: Call the service ONLY once. 
        // Ensure all Gelato logic (sign, create, execute) is inside this function.
        const result = await sponsorSafeTransferFrom(
            userPrivateKey,
            safeAddress,
            fromInput,
            toInput,
            amountWei
        );

        // 2. VALIDATE: If the relay failed or the contract reverted, stop here.
        if (!result || !result.taskId) {
            console.error("❌ Relay declined the transaction. Likely a revert.");
            return res.status(400).json({
              success: false, 
              message: "Transfer REVERTED: Check allowance or balance."
            });
        }

        // 3. RESOLVE USERS: Get real data for the history log.
        const fromUser = await User.findOne({ $or: [{ safeAddress: fromInput }, { accountNumber: fromInput }] });
        const toUser = await User.findOne({
          $or: [{ safeAddress: toInput }, { accountNumber: toInput }]
        });

        // 4. SAVE TO HISTORY: Only happens if the step above didn't fail.
        await new Transaction({
            fromAddress: safeAddress.toLowerCase(),
            fromAccountNumber: sender ? sender.accountNumber : null,
            toAddress: resolvedTo ? resolvedTo.toLowerCase() : null,
            toAccountNumber: toInput, 
            amount,
            status: 'successful', 
            type: 'transferFrom',
            taskId: result.taskId,
            date: new Date()
        }).save();

        res.json({ success: true, taskId: result.taskId });
    } catch (error) {
        console.error("❌ TransferFrom failed:", error.message);
        // This ensures the frontend shows an ERROR notification instead of "Success".
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