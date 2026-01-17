// stats.js
const express = require('express');
const router = express.Router();
const { ethers } = require('ethers');
const User = require('../models/User'); // Assuming you have a User model

// Minimal ABI to just get totalSupply
const NGNs_ABI = ["function totalSupply() view returns (uint256)"];
const NGNs_ADDRESS = "0xEe1195Ba5A9844a5b697A7a7070D7C2FBA0e45f0";

router.get('/stats', async (req, res) => {
  try {
    // 1. Get Live Blockchain Data
    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    const contract = new ethers.Contract(NGNs_ADDRESS, NGNs_ABI, provider);
    const rawSupply = await contract.totalSupply();
    
    // Convert from WEI (18 decimals) to readable NGN
    const totalSupply = ethers.formatUnits(rawSupply, 18);

    // 2. Get Live Database Data
    const userCount = await User.countDocuments(); // Counts every real user in DB

    res.json({
      totalSupply: parseFloat(totalSupply).toLocaleString(), // Adds commas: 1,000,000
      userCount: userCount.toLocaleString()
    });
  } catch (error) {
    console.error("Stats Fetch Error:", error);
    res.status(500).json({ totalSupply: "0", userCount: "0" });
  }
});

module.exports = router;