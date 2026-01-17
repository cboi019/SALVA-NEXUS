// Salva-Digital-Tech/Packages/backend/src/services/relayService.js
const { GelatoRelayPack } = require('@safe-global/relay-kit');
const SafeClient = require('@safe-global/protocol-kit').default;
const { ethers } = require('ethers');

const sponsorKey = process.env.GELATO_RELAY_API_KEY;

/**
 * HELPER: Formats input to BigInt if it's an account number, 
 * otherwise returns the address string.
 */
const formatTarget = (input) => {
    const isAlias = !input.startsWith('0x') && input.length <= 15;
    return isAlias ? BigInt(input) : input;
};

/**
 * HELPER: Determines if input is an account number
 */
const isAccountNumber = (input) => {
    return !input.startsWith('0x') && input.length <= 15;
};

async function initKits(safeAddress, ownerKey) {
    const protocolKit = await SafeClient.init({
        provider: process.env.BASE_SEPOLIA_RPC_URL,
        signer: ownerKey,
        safeAddress: safeAddress
    });
    const relayKit = new GelatoRelayPack({ apiKey: sponsorKey, protocolKit });
    return { protocolKit, relayKit };
}

// 1. FLEXIBLE TRANSFER - Uses correct function based on input type
async function sponsorSafeTransfer(safeAddress, ownerKey, recipient, amountWei) {
    const { protocolKit, relayKit } = await initKits(safeAddress, ownerKey);
    
    const isAlias = isAccountNumber(recipient);
    
    const iface = new ethers.Interface([
        isAlias 
            ? "function transferViaAccountAlias(uint128,uint256)" 
            : "function transfer(address,uint256)"
    ]);

    const calldata = iface.encodeFunctionData(
        isAlias ? "transferViaAccountAlias" : "transfer", 
        [isAlias ? BigInt(recipient) : recipient, amountWei]
    );

    console.log(`📤 Transfer Type: ${isAlias ? 'Account Alias' : 'Address'}`);
    console.log(`📤 Recipient: ${recipient}`);

    const transactions = [{ to: process.env.NGN_TOKEN_ADDRESS, data: calldata, value: '0' }];
    const safeTransaction = await relayKit.createTransaction({ transactions, options: { isSponsored: true } });
    const signedSafeTransaction = await protocolKit.signTransaction(safeTransaction);
    
    const result = await relayKit.executeTransaction({ 
        executable: signedSafeTransaction, 
        options: { isSponsored: true } 
    });

    console.log(`✅ Transfer TaskId: ${result.taskId}`);
    return result;
}

// 2. FLEXIBLE APPROVE
async function sponsorSafeApprove(safeAddress, ownerKey, spender, amountWei) {
    const { protocolKit, relayKit } = await initKits(safeAddress, ownerKey);
    
    const isAlias = isAccountNumber(spender);

    const iface = new ethers.Interface([
        isAlias 
            ? "function approveViaAccountAlias(uint128,uint256)" 
            : "function approve(address,uint256)"
    ]);

    const calldata = iface.encodeFunctionData(
        isAlias ? "approveViaAccountAlias" : "approve", 
        [isAlias ? BigInt(spender) : spender, amountWei]
    );

    console.log(`🔐 Approve Type: ${isAlias ? 'Account Alias' : 'Address'}`);
    console.log(`🔐 Spender: ${spender}`);

    const transactions = [{ to: process.env.NGN_TOKEN_ADDRESS, data: calldata, value: '0' }];
    const safeTransaction = await relayKit.createTransaction({ transactions, options: { isSponsored: true } });
    const signedSafeTransaction = await protocolKit.signTransaction(safeTransaction);
    
    const result = await relayKit.executeTransaction({ 
        executable: signedSafeTransaction, 
        options: { isSponsored: true } 
    });

    console.log(`✅ Approve TaskId: ${result.taskId}`);
    return result;
}

// 3. FLEXIBLE TRANSFER FROM - Uses correct function based on input types
async function sponsorSafeTransferFrom(ownerKey, safeAddress, from, to, amountWei) {
    const { protocolKit, relayKit } = await initKits(safeAddress, ownerKey);
    
    const isFromAlias = isAccountNumber(from);
    const isToAlias = isAccountNumber(to);

    let abi, functionName, params;

    // Use alias function if EITHER from or to is an account number
    if (isFromAlias || isToAlias) {
        functionName = "transferFromViaAccountAlias"; 
        abi = ["function transferFromViaAccountAlias(uint128,uint128,uint256)"];
        
        // Convert to BigInt for account numbers, keep as-is for addresses
        // Note: If mixing address+alias, the contract must handle address→uint128 conversion
        params = [
            isFromAlias ? BigInt(from) : from,
            isToAlias ? BigInt(to) : to,
            amountWei
        ];
    } else {
        // Both are addresses, use standard transferFrom
        functionName = "transferFrom";
        abi = ["function transferFrom(address,address,uint256)"];
        params = [from, to, amountWei];
    }

    console.log(`🔄 TransferFrom Type: ${functionName}`);
    console.log(`🔄 From: ${from} (${isFromAlias ? 'Alias' : 'Address'})`);
    console.log(`🔄 To: ${to} (${isToAlias ? 'Alias' : 'Address'})`);

    const iface = new ethers.Interface(abi);
    const calldata = iface.encodeFunctionData(functionName, params);

    const transactions = [{ to: process.env.NGN_TOKEN_ADDRESS, data: calldata, value: '0' }];
    
    const safeTransaction = await relayKit.createTransaction({ 
        transactions, 
        options: { isSponsored: true } 
    });
    const signedSafeTransaction = await protocolKit.signTransaction(safeTransaction);
    
    const result = await relayKit.executeTransaction({ 
        executable: signedSafeTransaction, 
        options: { isSponsored: true } 
    });

    console.log(`✅ TransferFrom TaskId: ${result.taskId}`);
    return result;
}

module.exports = { 
    sponsorSafeTransfer, 
    sponsorSafeApprove, 
    sponsorSafeTransferFrom 
};