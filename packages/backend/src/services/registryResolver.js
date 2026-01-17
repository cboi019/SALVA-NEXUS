// Salva-Digital-Tech/packages/backend/src/services/registryResolver.js
const { ethers } = require('ethers');
const { provider } = require('./walletSigner');

const REGISTRY_ABI = [
  "function getAddressFromNumber(uint128) view returns (address)",
  "function getNumberFromAddress(address) view returns (uint128)"
];

const registryContract = new ethers.Contract(
  process.env.REGISTRY_CONTRACT_ADDRESS, 
  REGISTRY_ABI, 
  provider
);

/**
 * Determines if input is an account number (not starting with 0x and <= 15 chars)
 */
function isAccountNumber(input) {
  return !input.startsWith('0x') && input.length <= 15;
}

/**
 * Resolves account number to wallet address using Registry contract
 */
async function getAddressFromAccountNumber(accountNumber) {
  try {
    const address = await registryContract.getAddressFromNumber(accountNumber);
    
    if (address === ethers.ZeroAddress) {
      throw new Error(`Account number ${accountNumber} not registered`);
    }
    
    console.log(`✅ Resolved account ${accountNumber} → ${address}`);
    return address.toLowerCase();
  } catch (error) {
    console.error(`❌ Failed to resolve account ${accountNumber}:`, error.message);
    throw new Error(`Account number ${accountNumber} not found`);
  }
}

/**
 * Resolves wallet address to account number using Registry contract
 */
async function getAccountNumberFromAddress(walletAddress) {
  try {
    const accountNumber = await registryContract.getNumberFromAddress(walletAddress);
    
    if (accountNumber === 0n) {
      console.log(`⚠️ Address ${walletAddress} has no account number`);
      return null;
    }
    
    console.log(`✅ Resolved address ${walletAddress} → ${accountNumber.toString()}`);
    return accountNumber.toString();
  } catch (error) {
    console.error(`❌ Failed to resolve address ${walletAddress}:`, error.message);
    return null;
  }
}

/**
 * Resolves any input (account number or address) to an address
 */
async function resolveToAddress(input) {
  if (isAccountNumber(input)) {
    return await getAddressFromAccountNumber(input);
  } else {
    // Validate it's a proper address
    if (!ethers.isAddress(input)) {
      throw new Error(`Invalid address: ${input}`);
    }
    return input.toLowerCase();
  }
}

module.exports = {
  isAccountNumber,
  getAddressFromAccountNumber,
  getAccountNumberFromAddress,
  resolveToAddress
};