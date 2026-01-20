// Salva-Digital-Tech/packages/backend/src/index.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
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
const { encryptPrivateKey, decryptPrivateKey, hashPin, verifyPin } = require('./utils/encryption');


// Initialize Resend and Gelato
const resend = new Resend(process.env.RESEND_API_KEY);
const relay = new GelatoRelay();

const app = express();
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: [
    'https://salva-nexus.org',
    'https://www.salva-nexus.org',
    'https://salva-nexus.onrender.com', 
    'http://localhost:3000',
    'http://localhost:5173'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

// Temporary storage for OTPs
const otpStore = {};

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('🍃 MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Connection Failed:', err));

// ===============================================
// HELPER: 8-Second Delay Before Blockchain Calls
// ===============================================
async function delayBeforeBlockchain(message = "Preparing transaction...") {
  console.log(`⏳ ${message} (8-second safety delay)`);
  await new Promise(resolve => setTimeout(resolve, 5000));
  console.log(`✅ Delay complete, executing blockchain call...`);
}

// ===============================================
// HELPER: Check Gelato Task Status (REVERT DETECTION)
// ===============================================
async function checkGelatoTaskStatus(taskId, maxRetries = 20, delayMs = 2000) {
  console.log(`🔍 Polling Gelato task status for: ${taskId}`);
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const status = await relay.getTaskStatus(taskId);
      console.log(`📊 Task ${taskId} status:`, status.taskState);

      if (status.taskState === 'ExecSuccess') {
        console.log(`✅ Task ${taskId} SUCCEEDED on-chain`);
        return { success: true, status: 'successful' };
      }

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

      if (['CheckPending', 'ExecPending', 'WaitingForConfirmation'].includes(status.taskState)) {
        console.log(`⏳ Task ${taskId} still pending... (attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }

      console.warn(`⚠️ Unknown task state: ${status.taskState}`);
      await new Promise(resolve => setTimeout(resolve, delayMs));

    } catch (error) {
      console.error(`❌ Error checking task status (attempt ${i + 1}):`, error.message);
      
      if (i === maxRetries - 1) {
        return { success: false, status: 'failed', reason: 'Could not verify transaction status' };
      }
      
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  console.error(`⏰ Task ${taskId} timed out after ${maxRetries} attempts`);
  return { success: false, status: 'failed', reason: 'Transaction verification timeout' };
}

// ===============================================
// AUTH & EMAIL ROUTES
// ===============================================

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
      from: 'Salva <no-reply@salva-nexus.org>',
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

app.post('/api/auth/verify-otp', (req, res) => {
  const { email, code } = req.body;
  const record = otpStore[email];

  if (!record || record.code !== code || Date.now() > record.expires) {
    return res.status(400).json({ message: 'Invalid or expired code' });
  }

  record.verified = true; 
  res.json({ success: true });
});

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
// FIXED GET APPROVALS - Display What Approver Used
// ===============================================
app.get('/api/approvals/:address', async (req, res) => {
  try {
    const ownerAddress = req.params.address.toLowerCase();
    const savedApprovals = await Approval.find({ owner: ownerAddress });
    
    const TOKEN_ABI = ["function allowance(address,address) view returns (uint256)"];
    const tokenContract = new ethers.Contract(process.env.NGN_TOKEN_ADDRESS, TOKEN_ABI, provider);
    
    const liveApprovals = await Promise.all(savedApprovals.map(async (app) => {
      try {
        // Use the stored address for blockchain query
        const spenderAddress = app.spender;
        const liveAllowanceWei = await tokenContract.allowance(ownerAddress, spenderAddress);
        const liveAmount = ethers.formatUnits(liveAllowanceWei, 6);
        
        // Delete if allowance is 0
        if (parseFloat(liveAmount) <= 0) {
          await Approval.deleteOne({ _id: app._id });
          return null; 
        }

        // Update amount if changed
        if (liveAmount !== app.amount) {
          await Approval.updateOne(
            { _id: app._id },
            { $set: { amount: liveAmount } }
          );
          app.amount = liveAmount;
        }

        // ✅ FIXED: Display based on what approver originally inputted
        let displaySpender;
        
        if (app.spenderInputType === 'accountNumber') {
          // Approver used account number, so display account number
          displaySpender = app.spenderInput;
        } else {
          // Approver used address, so display address
          displaySpender = spenderAddress;
        }
        
        return {
          _id: app._id,
          spender: spenderAddress,          // Actual address for operations
          displaySpender: displaySpender,   // ✅ What to show in UI (matching input type)
          amount: app.amount,
          date: app.date,
          inputType: app.spenderInputType   // For debugging/reference
        };
      } catch (err) {
        console.error(`Sync failed for ${app.spender}:`, err.message);
        return null;
      }
    }));

    res.json(liveApprovals.filter(app => app !== null));
  } catch (error) {
    console.error("Critical Approval Route Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ===============================================
// FIXED GET INCOMING ALLOWANCES - Display Matching Type
// ===============================================
app.get('/api/allowances-for/:address', async (req, res) => {
  try {
    const userAddress = req.params.address.toLowerCase();
    
    const TOKEN_ABI = ["function allowance(address,address) view returns (uint256)"];
    const tokenContract = new ethers.Contract(process.env.NGN_TOKEN_ADDRESS, TOKEN_ABI, provider);
    
    // Find all approvals where this user is the spender
    const allApprovals = await Approval.find({});
    
    const relevantApprovals = [];
    
    for (const app of allApprovals) {
      try {
        const spenderAddress = app.spender.toLowerCase();
        
        // Check if this approval's spender matches current user
        if (spenderAddress === userAddress) {
          // Check live allowance amount
          const liveAllowanceWei = await tokenContract.allowance(app.owner, userAddress);
          const liveAmount = ethers.formatUnits(liveAllowanceWei, 6);
          
          if (parseFloat(liveAmount) > 0) {
            // Update amount if changed
            if (liveAmount !== app.amount) {
              await Approval.updateOne({ _id: app._id }, { $set: { amount: liveAmount } });
            }
            
            // ✅ FIXED: Display based on what approver originally inputted
            let ownerDisplay;
            let spenderDisplay;
            
            if (app.spenderInputType === 'accountNumber') {
              // Approver used account number for spender, so use account numbers
              // Get owner's account number
              const ownerAccountNumber = await getAccountNumberFromAddress(app.owner);
              ownerDisplay = ownerAccountNumber || app.owner; // Fallback to address
              spenderDisplay = app.spenderInput; // What approver inputted
            } else {
              // Approver used address for spender, so use addresses
              ownerDisplay = app.owner;
              spenderDisplay = userAddress;
            }
            
            relevantApprovals.push({
              allower: ownerDisplay,              // ✅ FROM field - owner's identifier
              allowerAddress: app.owner,          // Actual address for backend
              spenderDisplay: spenderDisplay,     // ✅ TO field - spender's identifier
              amount: liveAmount,
              date: app.date,
              inputType: app.spenderInputType     // For debugging
            });
          } else {
            // Remove if allowance is 0
            await Approval.deleteOne({ _id: app._id });
          }
        }
      } catch (err) {
        console.error(`Error processing approval ${app._id}:`, err.message);
      }
    }

    res.json(relevantApprovals);
  } catch (error) {
    console.error("Critical Incoming Allowance Route Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ===============================================
// TRANSFER (Using Registry Contract ONLY)
// ===============================================
const { 
  isAccountNumber, 
  getAccountNumberFromAddress, 
  resolveToAddress 
} = require('./services/registryResolver');

// ===============================================
// TRANSFER (FIXED - Save failed transactions)
// ===============================================
app.post('/api/transfer', async (req, res) => {
  try {
    const { userPrivateKey, safeAddress, toInput, amount } = req.body;
    const amountWei = ethers.parseUnits(amount.toString(), 6);

    // Resolve recipient address using Registry
    let recipientAddress;
    try {
      recipientAddress = await resolveToAddress(toInput);
    } catch (error) {
      return res.status(404).json({ message: error.message });
    }

    // Determine what type the sender used for recipient
    const senderUsedAccountNumber = isAccountNumber(toInput);
    
    // Get sender's identifier of the SAME TYPE using Registry
    let senderDisplayIdentifier;
    let senderAccountNumber = null;
    
    if (senderUsedAccountNumber) {
      senderAccountNumber = await getAccountNumberFromAddress(safeAddress);
      senderDisplayIdentifier = senderAccountNumber || safeAddress.toLowerCase();
    } else {
      senderDisplayIdentifier = safeAddress.toLowerCase();
    }

    console.log(`📝 Transfer Details:`);
    console.log(`   Sender address: ${safeAddress}`);
    console.log(`   Sender used: ${senderUsedAccountNumber ? 'Account Number' : 'Address'}`);
    console.log(`   Sender identifier to store: ${senderDisplayIdentifier}`);
    console.log(`   Recipient input: ${toInput}`);
    console.log(`   Recipient address: ${recipientAddress}`);

    // 8-SECOND DELAY BEFORE BLOCKCHAIN CALL
    await delayBeforeBlockchain("Transfer queued");

    const result = await sponsorSafeTransfer(
      safeAddress, 
      userPrivateKey, 
      toInput, 
      amountWei
    );

    if (!result || !result.taskId) {
      console.error("❌ Transfer failed: No taskId returned");
      
      // FIXED: Save failed transaction
      await new Transaction({
        fromAddress: safeAddress.toLowerCase(),
        fromAccountNumber: senderAccountNumber,
        toAddress: recipientAddress,
        toAccountNumber: toInput,
        senderDisplayIdentifier: senderDisplayIdentifier,
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

    const taskStatus = await checkGelatoTaskStatus(result.taskId);
    
    // Save based on status (successful or failed)
    if (taskStatus.success) {
      await new Transaction({
        fromAddress: safeAddress.toLowerCase(),
        fromAccountNumber: senderAccountNumber,
        toAddress: recipientAddress,
        toAccountNumber: toInput,
        senderDisplayIdentifier: senderDisplayIdentifier,
        amount: amount,
        status: 'successful',
        taskId: result.taskId,
        type: 'transfer',
        date: new Date()
      }).save();
      
      console.log(`✅ Transaction saved as SUCCESSFUL`);
    } else {
      // FIXED: Save as failed instead of not saving at all
      await new Transaction({
        fromAddress: safeAddress.toLowerCase(),
        fromAccountNumber: senderAccountNumber,
        toAddress: recipientAddress,
        toAccountNumber: toInput,
        senderDisplayIdentifier: senderDisplayIdentifier,
        amount: amount,
        status: 'failed',
        taskId: result.taskId,
        type: 'transfer',
        date: new Date()
      }).save();
      
      console.log(`❌ Transaction saved as FAILED`);
      
      return res.status(400).json({ 
        success: false, 
        message: taskStatus.reason || "Transfer reverted on blockchain"
      });
    }

    res.json({ success: true, taskId: result.taskId });

  } catch (error) {
    console.error("❌ Transfer failed:", error.message);
    
    try {
      const senderUsedAccountNumber = isAccountNumber(req.body.toInput);
      let senderAccountNumber = null;
      let senderDisplayIdentifier;
      
      if (senderUsedAccountNumber) {
        senderAccountNumber = await getAccountNumberFromAddress(req.body.safeAddress);
        senderDisplayIdentifier = senderAccountNumber || req.body.safeAddress.toLowerCase();
      } else {
        senderDisplayIdentifier = req.body.safeAddress.toLowerCase();
      }
      
      let recipientAddress = null;
      try {
        recipientAddress = await resolveToAddress(req.body.toInput);
      } catch (e) {
        // Resolution failed
      }
      
      // FIXED: Save failed transaction
      await new Transaction({
        fromAddress: req.body.safeAddress.toLowerCase(),
        fromAccountNumber: senderAccountNumber,
        toAddress: recipientAddress,
        toAccountNumber: req.body.toInput,
        senderDisplayIdentifier: senderDisplayIdentifier,
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
// FIXED APPROVE ENDPOINT - Store What Approver Inputted
// ===============================================
app.post('/api/approve', async (req, res) => {
  try {
    const { userPrivateKey, safeAddress, spenderInput, amount } = req.body;
    
    // Resolve spender address using Registry
    let finalSpenderAddress;
    try {
      finalSpenderAddress = await resolveToAddress(spenderInput);
    } catch (error) {
      return res.status(404).json({ message: `Spender: ${error.message}` });
    }

    const amountWei = ethers.parseUnits(amount.toString(), 6);
    
    // 8-SECOND DELAY BEFORE BLOCKCHAIN CALL
    await delayBeforeBlockchain("Approval queued");

    const result = await sponsorSafeApprove(safeAddress, userPrivateKey, finalSpenderAddress, amountWei);

    if (!result || !result.taskId) {
      return res.status(400).json({ message: "Approval failed to submit" });
    }

    const taskStatus = await checkGelatoTaskStatus(result.taskId);
    if (!taskStatus.success) {
      return res.status(400).json({ success: false, message: taskStatus.reason || "Approval reverted" });
    }

    // ✅ FIXED: Store what approver inputted AND the resolved address
    const inputType = isAccountNumber(spenderInput) ? 'accountNumber' : 'address';
    
    await Approval.findOneAndUpdate(
      { 
        owner: safeAddress.toLowerCase(), 
        spender: finalSpenderAddress.toLowerCase()  // Address is the unique key
      },
      { 
        amount: amount, 
        date: new Date(),
        spenderInput: spenderInput,           // ✅ What approver typed
        spenderInputType: inputType           // ✅ Type of input used
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, taskId: result.taskId });
  } catch (error) {
    console.error("Approval Error:", error);
    res.status(500).json({ message: "Approval failed", error: error.message });
  }
});

// ===============================================
// GET TRANSACTIONS (FIXED - Show ALL transactions including failed)
// ===============================================
app.get('/api/transactions/:address', async (req, res) => {
  try {
    const address = req.params.address.toLowerCase();

    // FIXED: Show ALL transactions (successful AND failed), but only from sender's perspective
    const transactions = await Transaction.find({
      $or: [
        { fromAddress: address }, // Sent transactions (successful or failed)
        { toAddress: address, status: 'successful' } // Only successful received transactions
      ]
    }).sort({ date: -1 }).limit(50);

    const formatted = transactions.map(tx => {
      const isReceived = tx.toAddress?.toLowerCase() === address && tx.status === 'successful';
      const isFailed = tx.status === 'failed';
      
      // Display logic
      const displayPartner = isReceived 
        ? (tx.senderDisplayIdentifier || tx.fromAccountNumber || tx.fromAddress) // Show what sender used
        : (tx.toAccountNumber || tx.toAddress);    // Show recipient's info
      
      return {
        ...tx._doc,
        displayType: isFailed ? 'failed' : (isReceived ? 'receive' : 'sent'),
        displayPartner: displayPartner
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error("❌ History Fetch Error:", error);
    res.status(500).json([]);
  }
});

// ===============================================
// TRANSFER FROM (FIXED - Save failed transactions)
// ===============================================
app.post('/api/transferFrom', async (req, res) => {
  try {
    const { userPrivateKey, safeAddress, fromInput, toInput, amount } = req.body;
    const amountWei = ethers.parseUnits(amount.toString(), 6);

    // Resolve FROM address using Registry
    let fromAddress;
    try {
      fromAddress = await resolveToAddress(fromInput);
    } catch (error) {
      return res.status(404).json({ success: false, message: `Source: ${error.message}` });
    }

    // Resolve TO address using Registry
    let toAddress;
    try {
      toAddress = await resolveToAddress(toInput);
    } catch (error) {
      return res.status(404).json({ success: false, message: `Destination: ${error.message}` });
    }

    // Determine what type executor used for FROM input
    const fromInputWasAccountNumber = isAccountNumber(fromInput);
    
    // Get the source account's identifier of the SAME TYPE
    let senderDisplayIdentifier;
    if (fromInputWasAccountNumber) {
      senderDisplayIdentifier = fromInput;
    } else {
      senderDisplayIdentifier = fromAddress;
    }

    console.log(`📝 TransferFrom Details:`);
    console.log(`   Executor address: ${safeAddress}`);
    console.log(`   Executor used for FROM: ${fromInputWasAccountNumber ? 'Account Number' : 'Address'}`);
    console.log(`   Sender identifier to store: ${senderDisplayIdentifier}`);
    console.log(`   From input: ${fromInput} → ${fromAddress}`);
    console.log(`   To input: ${toInput} → ${toAddress}`);

    // 8-SECOND DELAY BEFORE BLOCKCHAIN CALL
    await delayBeforeBlockchain("TransferFrom queued");

    const result = await sponsorSafeTransferFrom(
      userPrivateKey,
      safeAddress,
      fromAddress,
      toAddress,
      amountWei
    );

    if (!result || !result.taskId) {
      // FIXED: Save failed transaction
      await new Transaction({
        fromAddress: fromAddress,
        fromAccountNumber: fromInputWasAccountNumber ? fromInput : null,
        toAddress: toAddress,
        toAccountNumber: toInput,
        senderDisplayIdentifier: senderDisplayIdentifier,
        executorAddress: safeAddress.toLowerCase(),
        amount: amount,
        status: 'failed',
        taskId: null,
        type: 'transferFrom',
        date: new Date()
      }).save();
      
      return res.status(400).json({ success: false, message: "Transfer failed to submit" });
    }

    const taskStatus = await checkGelatoTaskStatus(result.taskId);
    
    // Save based on status
    if (taskStatus.success) {
      await new Transaction({
        fromAddress: fromAddress,
        fromAccountNumber: fromInputWasAccountNumber ? fromInput : null,
        toAddress: toAddress,
        toAccountNumber: toInput,
        senderDisplayIdentifier: senderDisplayIdentifier,
        executorAddress: safeAddress.toLowerCase(),
        amount: amount,
        status: 'successful', 
        type: 'transferFrom',
        taskId: result.taskId,
        date: new Date()
      }).save();
      
      console.log(`✅ TransferFrom saved as SUCCESSFUL`);
    } else {
      // FIXED: Save as failed
      await new Transaction({
        fromAddress: fromAddress,
        fromAccountNumber: fromInputWasAccountNumber ? fromInput : null,
        toAddress: toAddress,
        toAccountNumber: toInput,
        senderDisplayIdentifier: senderDisplayIdentifier,
        executorAddress: safeAddress.toLowerCase(),
        amount: amount,
        status: 'failed',
        taskId: result.taskId,
        type: 'transferFrom',
        date: new Date()
      }).save();
      
      console.log(`❌ TransferFrom saved as FAILED`);
      
      return res.status(400).json({
        success: false, 
        message: taskStatus.reason || "Transfer reverted: Check allowance or balance"
      });
    }

    res.json({ success: true, taskId: result.taskId });

  } catch (error) {
    console.error("❌ TransferFrom failed:", error.message);
    
    try {
      // FIXED: Save failed transaction on exception
      const fromInputWasAccountNumber = isAccountNumber(req.body.fromInput);
      let fromAddress, toAddress;
      
      try {
        fromAddress = await resolveToAddress(req.body.fromInput);
        toAddress = await resolveToAddress(req.body.toInput);
      } catch (e) {
        // Resolution failed
      }
      
      const senderDisplayIdentifier = fromInputWasAccountNumber ? req.body.fromInput : fromAddress;
      
      await new Transaction({
        fromAddress: fromAddress,
        fromAccountNumber: fromInputWasAccountNumber ? req.body.fromInput : null,
        toAddress: toAddress,
        toAccountNumber: req.body.toInput,
        senderDisplayIdentifier: senderDisplayIdentifier,
        executorAddress: req.body.safeAddress.toLowerCase(),
        amount: req.body.amount,
        status: 'failed',
        taskId: null,
        type: 'transferFrom',
        date: new Date()
      }).save();
    } catch (dbError) {
      console.error("Failed to save failed transaction:", dbError);
    }
    
    res.status(400).json({ success: false, message: "Transfer failed", error: error.message });
  }
});

// ===============================================
// GET INCOMING ALLOWANCES (FIXED - Display matching type)
// ===============================================
app.get('/api/allowances-for/:address', async (req, res) => {
  try {
    const userAddress = req.params.address.toLowerCase();
    
    const TOKEN_ABI = ["function allowance(address,address) view returns (uint256)"];
    const tokenContract = new ethers.Contract(process.env.NGN_TOKEN_ADDRESS, TOKEN_ABI, provider);
    
    // Find all approvals
    const allApprovals = await Approval.find({});
    
    const relevantApprovals = [];
    
    for (const app of allApprovals) {
      try {
        // Resolve the stored spender to an address
        let spenderAddress;
        try {
          spenderAddress = await resolveToAddress(app.spender);
        } catch (e) {
          spenderAddress = app.spender.toLowerCase();
        }
        
        // Check if this approval's spender matches current user
        if (spenderAddress.toLowerCase() === userAddress.toLowerCase()) {
          // Check live allowance amount
          const liveAllowanceWei = await tokenContract.allowance(app.owner, userAddress);
          const liveAmount = ethers.formatUnits(liveAllowanceWei, 6);
          
          if (parseFloat(liveAmount) > 0) {
            // Update amount if changed
            if (liveAmount !== app.amount) {
              await Approval.updateOne({ _id: app._id }, { $set: { amount: liveAmount } });
            }
            
            // FIXED: Determine what type the approver (owner) used
            const approverUsedAccountNumber = isAccountNumber(app.displaySpender || app.spender);
            
            let ownerDisplay;
            let spenderDisplay;
            
            if (approverUsedAccountNumber) {
              // Owner used account number for spender, so:
              // - Show owner's account number
              // - Keep spender's account number (what owner inputted)
              ownerDisplay = await getAccountNumberFromAddress(app.owner);
              if (!ownerDisplay) ownerDisplay = app.owner; // Fallback to address
              spenderDisplay = app.displaySpender || app.spender; // What owner inputted
            } else {
              // Owner used address for spender, so:
              // - Show owner's address
              // - Keep spender's address
              ownerDisplay = app.owner;
              spenderDisplay = userAddress; // Current user's address
            }
            
            relevantApprovals.push({
              allower: ownerDisplay,              // What to show for "FROM" in form
              allowerAddress: app.owner,          // Actual address for backend
              spenderDisplay: spenderDisplay,     // What to show for "TO" in form  
              amount: liveAmount,
              date: app.date
            });
          } else {
            // Remove if allowance is 0
            await Approval.deleteOne({ _id: app._id });
          }
        }
      } catch (err) {
        console.error(`Error processing approval ${app._id}:`, err.message);
      }
    }

    res.json(relevantApprovals);
  } catch (error) {
    console.error("Critical Incoming Allowance Route Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ADD TO index.js - PIN MANAGEMENT ROUTES

// ===============================================
// CHECK IF USER NEEDS TO SET PIN (After Registration/Login)
// ===============================================
app.get('/api/user/pin-status/:email', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      hasPin: !!user.transactionPin,
      pinSetupCompleted: user.pinSetupCompleted || false,
      isLocked: user.accountLockedUntil && new Date(user.accountLockedUntil) > new Date(),
      lockedUntil: user.accountLockedUntil
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to check PIN status" });
  }
});

// ===============================================
// SET TRANSACTION PIN (First Time Setup) - FIXED
// ===============================================
app.post('/api/user/set-pin', async (req, res) => {
  try {
    const { email, pin } = req.body;

    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({ message: "PIN must be exactly 4 digits" });
    }

    // ✅ FIX: Try to find user by email OR username (fallback)
    let user = await User.findOne({ email });
    
    if (!user) {
      // If not found by email, try username (for old users)
      user = await User.findOne({ username: email });
    }
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if PIN already exists
    if (user.transactionPin) {
      return res.status(400).json({ message: "PIN already set. Use reset-pin instead." });
    }

    // Hash the PIN for storage
    const hashedPin = hashPin(pin);

    // Encrypt the private key with the PIN
    const encryptedKey = encryptPrivateKey(user.ownerPrivateKey, pin);

    // Update user
    user.transactionPin = hashedPin;
    user.ownerPrivateKey = encryptedKey;
    user.pinSetupCompleted = true;
    // NO LOCKOUT for first-time setup
    await user.save();

    console.log(`✅ PIN set for user: ${user.email || user.username}`);
    res.json({ success: true, message: "Transaction PIN set successfully!" });
  } catch (error) {
    console.error("❌ Set PIN error:", error);
    res.status(500).json({ message: "Failed to set PIN" });
  }
});

// ===============================================
// VERIFY TRANSACTION PIN - FIXED
// ===============================================
app.post('/api/user/verify-pin', async (req, res) => {
  try {
    const { email, pin } = req.body;

    // ✅ FIX: Try email first, then username
    let user = await User.findOne({ email });
    
    if (!user) {
      user = await User.findOne({ username: email });
    }
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.transactionPin) {
      return res.status(400).json({ message: "No PIN set. Please set PIN first." });
    }

    // Verify PIN
    const isValid = verifyPin(pin, user.transactionPin);

    if (!isValid) {
      return res.status(401).json({ success: false, message: "Invalid PIN" });
    }

    // Check if account is locked
    if (user.accountLockedUntil && new Date(user.accountLockedUntil) > new Date()) {
      const hoursLeft = Math.ceil((new Date(user.accountLockedUntil) - new Date()) / (1000 * 60 * 60));
      return res.status(403).json({ 
        message: `Account locked for ${hoursLeft} more hours due to recent security changes.`,
        lockedUntil: user.accountLockedUntil
      });
    }

    // Decrypt private key temporarily for transaction
    try {
      const decryptedKey = decryptPrivateKey(user.ownerPrivateKey, pin);
      res.json({ 
        success: true, 
        privateKey: decryptedKey
      });
    } catch (decryptError) {
      return res.status(401).json({ success: false, message: "Invalid PIN or corrupted key" });
    }
  } catch (error) {
    console.error("❌ Verify PIN error:", error);
    res.status(500).json({ message: "Failed to verify PIN" });
  }
});

// ===============================================
// RESET TRANSACTION PIN (With OTP and 24HR Lockout)
// ===============================================
app.post('/api/user/reset-pin', async (req, res) => {
  try {
    const { email, newPin } = req.body;

    // OTP should already be verified at this point (frontend handles OTP flow)
    if (!otpStore[email] || !otpStore[email].verified) {
      return res.status(401).json({ message: "Please verify OTP first" });
    }

    if (!newPin || newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      return res.status(400).json({ message: "PIN must be exactly 4 digits" });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Decrypt private key with OLD PIN first (if it was encrypted)
    let privateKey = user.ownerPrivateKey;
    if (user.transactionPin) {
      // For users with existing PIN, we need the old PIN to decrypt
      // But since they're resetting via OTP, we'll need to handle this differently
      // For now, if they're resetting, assume they've lost access
      // In production, you might want to add a backup recovery mechanism
      try {
        // Try to decrypt with a dummy attempt - if it fails, key is already plain
        if (privateKey.includes(':')) {
          throw new Error("Cannot decrypt old key without old PIN");
        }
      } catch (e) {
        return res.status(400).json({ 
          message: "Cannot reset PIN without old PIN. Contact support." 
        });
      }
    }

    // Hash new PIN and encrypt private key
    const hashedPin = hashPin(newPin);
    const encryptedKey = encryptPrivateKey(privateKey, newPin);

    // Set 24-hour lockout
    const lockoutTime = new Date(Date.now() + 24 * 60 * 60 * 1000);

    user.transactionPin = hashedPin;
    user.ownerPrivateKey = encryptedKey;
    user.accountLockedUntil = lockoutTime;
    await user.save();

    delete otpStore[email];

    console.log(`✅ PIN reset for user: ${email}, locked until: ${lockoutTime}`);
    res.json({ 
      success: true, 
      message: "PIN reset successful. Account locked for 24 hours.",
      lockedUntil: lockoutTime
    });
  } catch (error) {
    console.error("❌ Reset PIN error:", error);
    res.status(500).json({ message: "Failed to reset PIN" });
  }
});

// ===============================================
// UPDATE EMAIL (With 24HR Lockout)
// ===============================================
app.post('/api/user/update-email', async (req, res) => {
  try {
    const { oldEmail, newEmail } = req.body;

    if (!otpStore[oldEmail] || !otpStore[oldEmail].verified) {
      return res.status(401).json({ message: "Please verify OTP first" });
    }

    const user = await User.findOne({ email: oldEmail });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Check if new email already exists
    const existingUser = await User.findOne({ email: newEmail });
    if (existingUser) {
      return res.status(400).json({ message: "Email already in use" });
    }

    // Set 24-hour lockout
    const lockoutTime = new Date(Date.now() + 24 * 60 * 60 * 1000);

    user.email = newEmail;
    user.accountLockedUntil = lockoutTime;
    await user.save();

    delete otpStore[oldEmail];

    res.json({ 
      success: true, 
      message: "Email updated. Account locked for 24 hours.",
      lockedUntil: lockoutTime
    });
  } catch (error) {
    console.error("❌ Update email error:", error);
    res.status(500).json({ message: "Failed to update email" });
  }
});

// ===============================================
// UPDATE PASSWORD (With 24HR Lockout)
// ===============================================
app.post('/api/user/update-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!otpStore[email] || !otpStore[email].verified) {
      return res.status(401).json({ message: "Please verify OTP first" });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Set 24-hour lockout
    const lockoutTime = new Date(Date.now() + 24 * 60 * 60 * 1000);

    user.password = hashedPassword;
    user.accountLockedUntil = lockoutTime;
    await user.save();

    delete otpStore[email];

    res.json({ 
      success: true, 
      message: "Password updated. Account locked for 24 hours.",
      lockedUntil: lockoutTime
    });
  } catch (error) {
    console.error("❌ Update password error:", error);
    res.status(500).json({ message: "Failed to update password" });
  }
});

// ===============================================
// UPDATE USERNAME (No lockout)
// ===============================================
app.post('/api/user/update-username', async (req, res) => {
  try {
    const { email, newUsername } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Check if username already exists
    const existingUser = await User.findOne({ username: newUsername });
    if (existingUser && existingUser._id.toString() !== user._id.toString()) {
      return res.status(400).json({ message: "Username already taken" });
    }

    user.username = newUsername;
    await user.save();

    res.json({ success: true, message: "Username updated successfully!" });
  } catch (error) {
    console.error("❌ Update username error:", error);
    res.status(500).json({ message: "Failed to update username" });
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

const PORT = process.env.PORT || 10000;

app.use((err, req, res, next) => {
  console.error('Final Catch-All Error:', err.stack);
  res.status(500).json({ 
    message: 'Internal Server Error', 
    error: process.env.NODE_ENV === 'production' ? {} : err.message 
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 SALVA BACKEND ACTIVE ON PORT ${PORT}`);
});

const INTERVAL = 10 * 60 * 1000;
const URL = "https://salva-api.onrender.com/api/stats";

function reloadWebsite() {
  fetch(URL)
    .then(() => console.log("⚓ Keep-Alive: Side-ping successful"))
    .catch((err) => console.error("⚓ Keep-Alive Error:", err.message));
}

setInterval(reloadWebsite, INTERVAL);