// relayService.js
const { GelatoRelayPack } = require('@safe-global/relay-kit');
const SafeClient = require('@safe-global/protocol-kit').default; // Import the kit
const { ethers } = require('ethers');

const sponsorKey = process.env.GELATO_RELAY_API_KEY;

// UPDATED: Now takes the safeAddress and ownerKey (private key) instead of a kit object
async function sponsorSafeTransfer(safeAddress, ownerKey, recipient, amountWei) {
    // 1. Initialize the Signer and Protocol Kit
    const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
    const signer = new ethers.Wallet(ownerKey, provider);

    const protocolKit = await SafeClient.init({
        provider: process.env.BASE_SEPOLIA_RPC_URL,
        signer: ownerKey,
        safeAddress: safeAddress
    });

    const relayKit = new GelatoRelayPack({ 
        apiKey: sponsorKey, 
        protocolKit 
    });

    let calldata;
    // Check if recipient is account number or address
    const isAccountNumber = !recipient.startsWith('0x') && recipient.length <= 15;
    
    if (isAccountNumber) {
        const iface = new ethers.Interface(["function transferViaAccountAlias(uint128,uint256)"]);
        calldata = iface.encodeFunctionData("transferViaAccountAlias", [BigInt(recipient), amountWei]);
        console.log(`✅ Encoding Alias Transfer: ${recipient}`);
    } else {
        const iface = new ethers.Interface(["function transfer(address,uint256)"]);
        calldata = iface.encodeFunctionData("transfer", [recipient, amountWei]);
        console.log(`✅ Encoding Address Transfer: ${recipient}`);
    }

    const transactions = [{
        to: process.env.NGN_TOKEN_ADDRESS,
        data: calldata,
        value: '0'
    }];

    console.log("🛠️ Preparing Safe transaction for Gelato...");

    const safeTransaction = await relayKit.createTransaction({ 
        transactions, 
        options: { isSponsored: true }
    });
    
    // Sign the transaction before sending to Gelato
    const signedSafeTransaction = await protocolKit.signTransaction(safeTransaction);
    
    return await relayKit.executeTransaction({
        executable: signedSafeTransaction,
        options: { isSponsored: true }
    });
}

module.exports = { sponsorSafeTransfer };