// relayService.js
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

async function initKits(safeAddress, ownerKey) {
    const protocolKit = await SafeClient.init({
        provider: process.env.BASE_SEPOLIA_RPC_URL,
        signer: ownerKey,
        safeAddress: safeAddress
    });
    const relayKit = new GelatoRelayPack({ apiKey: sponsorKey, protocolKit });
    return { protocolKit, relayKit };
}

// 1. FLEXIBLE TRANSFER
async function sponsorSafeTransfer(safeAddress, ownerKey, recipient, amountWei) {
    const { protocolKit, relayKit } = await initKits(safeAddress, ownerKey);
    const target = formatTarget(recipient);
    
    const iface = new ethers.Interface([
        typeof target === 'bigint' 
            ? "function transferViaAccountAlias(uint128,uint256)" 
            : "function transfer(address,uint256)"
    ]);

    const calldata = iface.encodeFunctionData(
        typeof target === 'bigint' ? "transferViaAccountAlias" : "transfer", 
        [target, amountWei]
    );

    const transactions = [{ to: process.env.NGN_TOKEN_ADDRESS, data: calldata, value: '0' }];
    const safeTransaction = await relayKit.createTransaction({ transactions, options: { isSponsored: true } });
    const signedSafeTransaction = await protocolKit.signTransaction(safeTransaction);
    return await relayKit.executeTransaction({ executable: signedSafeTransaction, options: { isSponsored: true } });
}

// 2. FLEXIBLE APPROVE
async function sponsorSafeApprove(safeAddress, ownerKey, spender, amountWei) {
    const { protocolKit, relayKit } = await initKits(safeAddress, ownerKey);
    const target = formatTarget(spender);

    const iface = new ethers.Interface([
        typeof target === 'bigint' 
            ? "function approveViaAccountAlias(uint128,uint256)" 
            : "function approve(address,uint256)"
    ]);

    const calldata = iface.encodeFunctionData(
        typeof target === 'bigint' ? "approveViaAccountAlias" : "approve", 
        [target, amountWei]
    );

    const transactions = [{ to: process.env.NGN_TOKEN_ADDRESS, data: calldata, value: '0' }];
    const safeTransaction = await relayKit.createTransaction({ transactions, options: { isSponsored: true } });
    const signedSafeTransaction = await protocolKit.signTransaction(safeTransaction);
    return await relayKit.executeTransaction({ executable: signedSafeTransaction, options: { isSponsored: true } });
}

// 3. FLEXIBLE TRANSFER FROM
async function sponsorSafeTransferFrom(ownerKey, safeAddress, from, to, amountWei) {
    const { protocolKit, relayKit } = await initKits(safeAddress, ownerKey);
    
    const fromTarget = formatTarget(from);
    const toTarget = formatTarget(to);

    const isFromAlias = typeof fromTarget === 'bigint';
    const isToAlias = typeof toTarget === 'bigint';

    let abi, functionName, params;

    // Correct Logic: Only use the Alias function if at least ONE input is an Alias
    if (isFromAlias || isToAlias) {
        functionName = "transferFromViaAccountAlias"; 
        abi = ["function transferFromViaAccountAlias(uint128,uint128,uint256)"];
        
        // Convert to BigInt for uint128 ONLY if it's an alias string, 
        // else the contract expects the uint128 representation of the address or the alias.
        params = [
            isFromAlias ? fromTarget : from, // Contract needs to handle address-to-uint128 conversion or this will revert
            isToAlias ? toTarget : to,
            amountWei
        ];
    } else {
        functionName = "transferFrom";
        abi = ["function transferFrom(address,address,uint256)"];
        params = [from, to, amountWei];
    }

    const iface = new ethers.Interface(abi);
    const calldata = iface.encodeFunctionData(functionName, params);

    const transactions = [{ to: process.env.NGN_TOKEN_ADDRESS, data: calldata, value: '0' }];
    
    const safeTransaction = await relayKit.createTransaction({ transactions, options: { isSponsored: true } });
    const signedSafeTransaction = await protocolKit.signTransaction(safeTransaction);
    
    // Final execute call
    return await relayKit.executeTransaction({ 
        executable: signedSafeTransaction, 
        options: { isSponsored: true } 
    });
}