// Salva-Digital-Tech/packages/backend/src/utils/encryption.js
const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

/**
 * Encrypts the private key using the user's PIN
 * @param {string} privateKey - The private key to encrypt
 * @param {string} pin - The 4-digit PIN
 * @returns {string} - Encrypted private key in format: iv:encryptedData
 */
function encryptPrivateKey(privateKey, pin) {
    // Create a 32-byte key from the 4-digit PIN using SHA-256
    const key = crypto.createHash('sha256').update(String(pin)).digest();
    
    // Generate random IV
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Create cipher and encrypt
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Return IV + encrypted data (we need IV to decrypt later)
    return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypts the private key using the user's PIN
 * @param {string} encryptedPrivateKey - The encrypted private key (iv:encryptedData format)
 * @param {string} pin - The 4-digit PIN
 * @returns {string} - Decrypted private key
 */
function decryptPrivateKey(encryptedPrivateKey, pin) {
    try {
        // Split IV and encrypted data
        const parts = encryptedPrivateKey.split(':');
        if (parts.length !== 2) {
            throw new Error('Invalid encrypted key format');
        }
        
        const iv = Buffer.from(parts[0], 'hex');
        const encryptedData = parts[1];
        
        // Create key from PIN
        const key = crypto.createHash('sha256').update(String(pin)).digest();
        
        // Create decipher and decrypt
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (error) {
        throw new Error('Invalid PIN or corrupted data');
    }
}

/**
 * Hashes a PIN for secure storage (for verification)
 * @param {string} pin - The 4-digit PIN
 * @returns {string} - Hashed PIN
 */
function hashPin(pin) {
    return crypto.createHash('sha256').update(String(pin)).digest('hex');
}

/**
 * Verifies a PIN against its hash
 * @param {string} pin - The PIN to verify
 * @param {string} hashedPin - The stored hash
 * @returns {boolean} - True if PIN matches
 */
function verifyPin(pin, hashedPin) {
    const inputHash = hashPin(pin);
    return inputHash === hashedPin;
}

module.exports = {
    encryptPrivateKey,
    decryptPrivateKey,
    hashPin,
    verifyPin
};