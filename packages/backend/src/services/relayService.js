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
async function sponsorSafeTransferFrom(safeAddress, ownerKey, from, to, amountWei) {
    const { protocolKit, relayKit } = await initKits(safeAddress, ownerKey);
    
    const fromTarget = formatTarget(from);
    const toTarget = formatTarget(to);

    // Logic: If either is an Alias, use the Alias function. 
    // This assumes your contract has a 'transferFromViaAlias' or similar.
    // If your contract ONLY supports transferFrom(address, address, uint256), 
    // the backend index.js will resolve the aliases to addresses before calling this.
    
    const iface = new ethers.Interface(["function transferFrom(address,address,uint256)"]);
    const calldata = iface.encodeFunctionData("transferFrom", [fromTarget, toTarget, amountWei]);

    const transactions = [{ to: process.env.NGN_TOKEN_ADDRESS, data: calldata, value: '0' }];
    const safeTransaction = await relayKit.createTransaction({ transactions, options: { isSponsored: true } });
    const signedSafeTransaction = await protocolKit.signTransaction(safeTransaction);
    return await relayKit.executeTransaction({ executable: signedSafeTransaction, options: { isSponsored: true } });
}

module.exports = { 
    sponsorSafeTransfer, 
    sponsorSafeApprove, 
    sponsorSafeTransferFrom 
};