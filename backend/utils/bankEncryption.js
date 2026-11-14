import crypto from "crypto";
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

// Get encryption key from environment
const getEncryptionKey = () => {
    const keyHex = process.env.BANK_ENCRYPTION_KEY;

    if(!keyHex || !/^[a-fA-F0-9]{64}$/.test(keyHex)){
        throw new Error("BANK_ENCRYPTION_KEY must be a 64-character hexadecimal key.");
    }

    return Buffer.from(keyHex, "hex");
};

// Encrypt bank account number
const encryptBankAccount = (accountNumber) => {
    if(typeof accountNumber !== "string" || !accountNumber){
        throw new Error("Valid bank account number is required.");
    }

    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    const encrypted = Buffer.concat([
        cipher.update(accountNumber, "utf8"),
        cipher.final()
    ]);

    const authTag = cipher.getAuthTag();

    return ["v1", iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
};

// Decrypt bank account number
const decryptBankAccount = (encryptedValue) => {
    if(typeof encryptedValue !== "string"){
        throw new Error("Invalid encrypted bank account.");
    }

    const parts = encryptedValue.split(":");

    if(parts.length !== 4 || parts[0] !== "v1"){
        throw new Error("Invalid bank account encryption format.");
    }

    const [, ivHex, authTagHex, encryptedHex] = parts;

    const isValidHex = (value) => typeof value === "string" && value.length > 0 && value.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(value);

    if(!isValidHex(ivHex) || !isValidHex(authTagHex) || !isValidHex(encryptedHex)){
        throw new Error("Invalid encrypted bank account data.");
    }

    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const encrypted = Buffer.from(encryptedHex, "hex");

    if(iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH || encrypted.length === 0){
        throw new Error("Invalid encrypted bank account data.");
    }

    const key = getEncryptionKey();

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
    ]);

    return decrypted.toString("utf8");
};

export {encryptBankAccount, decryptBankAccount};