#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ed25519_1 = require("@mysten/sui/keypairs/ed25519");
const client_1 = require("@mysten/sui/client");
const bip39 = __importStar(require("bip39"));
const utils_1 = require("@mysten/sui/utils");
const readline = __importStar(require("readline"));
const chalk_1 = __importDefault(require("chalk"));
const figlet_1 = __importDefault(require("figlet"));
class SuiVanityWallet {
    constructor() {
        this.client = new client_1.SuiClient({ url: (0, client_1.getFullnodeUrl)('mainnet') });
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }
    async displayHeader() {
        console.clear();
        console.log(chalk_1.default.cyan('═'.repeat(50)));
        console.log(chalk_1.default.cyan(figlet_1.default.textSync('SUI CLI', {
            font: 'Small',
            horizontalLayout: 'fitted'
        })));
        console.log(chalk_1.default.blue('    Sui Vanity Wallet Generator'));
        console.log(chalk_1.default.cyan('═'.repeat(50)));
        console.log();
    }
    async displayMenu() {
        console.log(chalk_1.default.white('What would you like to do?'));
        console.log(chalk_1.default.yellow('1.') + ' Generate a random wallet');
        console.log(chalk_1.default.yellow('2.') + ' Generate a vanity address');
        console.log(chalk_1.default.yellow('3.') + ' Recover wallet from mnemonic');
        console.log();
        process.stdout.write(chalk_1.default.magenta('Enter option (1-3): '));
    }
    generateRandomWallet() {
        const mnemonic = bip39.generateMnemonic();
        const seed = bip39.mnemonicToSeedSync(mnemonic).slice(0, 32);
        const keypair = ed25519_1.Ed25519Keypair.fromSecretKey(seed);
        const address = keypair.getPublicKey().toSuiAddress();
        return { keypair, mnemonic, address };
    }
    async generateVanityAddress(pattern, position = 'start') {
        let attempts = 0;
        const startTime = Date.now();
        const normalizedPattern = pattern.toLowerCase().startsWith('0x')
            ? pattern.toLowerCase().substring(2)
            : pattern.toLowerCase();
        console.log(chalk_1.default.blue(`\nSearching for address ${position === 'start' ? 'starting with' : position === 'end' ? 'ending with' : 'containing'} "${normalizedPattern}"...`));
        console.log(chalk_1.default.gray('This may take a while depending on the pattern complexity.\n'));
        while (true) {
            attempts++;
            const wallet = this.generateRandomWallet();
            const addressWithoutPrefix = wallet.address.slice(2).toLowerCase();
            let matches = false;
            if (position === 'start') {
                matches = addressWithoutPrefix.startsWith(normalizedPattern);
            }
            else if (position === 'end') {
                matches = addressWithoutPrefix.endsWith(normalizedPattern);
            }
            else {
                matches = addressWithoutPrefix.includes(normalizedPattern);
            }
            if (matches) {
                const elapsed = (Date.now() - startTime) / 1000;
                console.log(chalk_1.default.green(`\n✓ Found matching address after ${attempts} attempts in ${elapsed.toFixed(2)}s!`));
                return { ...wallet, attempts };
            }
            if (attempts % 1000 === 0) {
                const elapsed = (Date.now() - startTime) / 1000;
                const rate = attempts / elapsed;
                process.stdout.write(`\r${chalk_1.default.yellow(`Attempts: ${attempts.toLocaleString()} | Rate: ${rate.toFixed(0)}/s | Time: ${elapsed.toFixed(1)}s`)}`);
            }
        }
    }
    recoverFromMnemonic(mnemonic) {
        const normalizedMnemonic = mnemonic.trim().toLowerCase();
        if (!bip39.validateMnemonic(normalizedMnemonic)) {
            throw new Error('Invalid mnemonic phrase. Please check your words and try again.');
        }
        const seed = bip39.mnemonicToSeedSync(normalizedMnemonic).slice(0, 32);
        const keypair = ed25519_1.Ed25519Keypair.fromSecretKey(seed);
        const address = keypair.getPublicKey().toSuiAddress();
        return { keypair, address };
    }
    async getBalance(address) {
        try {
            const balance = await this.client.getBalance({ owner: address });
            const suiBalance = parseInt(balance.totalBalance) / 1000000000;
            return suiBalance.toFixed(4);
        }
        catch (error) {
            return 'Error fetching balance';
        }
    }
    displayWalletInfo(wallet) {
        console.log(chalk_1.default.cyan('\n═'.repeat(70)));
        console.log(chalk_1.default.green.bold('                    WALLET GENERATED'));
        console.log(chalk_1.default.cyan('═'.repeat(70)));
        console.log(chalk_1.default.white.bold('\n📍 Address:'));
        console.log(chalk_1.default.green('   ' + wallet.address));
        if (wallet.mnemonic) {
            console.log(chalk_1.default.white.bold('\n🔑 Mnemonic Phrase:'));
            console.log(chalk_1.default.yellow('   ' + wallet.mnemonic));
        }
        if (wallet.privateKey) {
            console.log(chalk_1.default.white.bold('\n🔐 Private Key:'));
            console.log(chalk_1.default.red('   ' + wallet.privateKey));
        }
        if (wallet.balance) {
            console.log(chalk_1.default.white.bold('\n💰 Balance:'));
            console.log(chalk_1.default.green('   ' + wallet.balance + ' SUI'));
        }
        console.log(chalk_1.default.cyan('\n═'.repeat(70)));
        console.log(chalk_1.default.red.bold('⚠️  SECURITY WARNING:'));
        console.log(chalk_1.default.red('   Keep your mnemonic and private key safe and secret!'));
        console.log(chalk_1.default.red('   Never share them with anyone or store them online!'));
        console.log(chalk_1.default.cyan('═'.repeat(70)));
    }
    async askQuestion(question) {
        return new Promise((resolve) => {
            this.rl.question(question, (answer) => {
                resolve(answer.trim());
            });
        });
    }
    async askYesNo(question) {
        const answer = await this.askQuestion(question + ' (y/n): ');
        return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
    }
    exportPrivateKey(keypair) {
        const secretKey = keypair.getSecretKey();
        // Ensure secretKey is a Uint8Array; if it's a string, convert it
        const secretKeyArray = typeof secretKey === 'string' ? Buffer.from(secretKey, 'base64') : new Uint8Array(secretKey);
        return (0, utils_1.toBase64)(secretKeyArray);
    }
    async run() {
        try {
            while (true) {
                await this.displayHeader();
                await this.displayMenu();
                const choice = await this.askQuestion('');
                switch (choice) {
                    case '1': {
                        console.log(chalk_1.default.blue('\nGenerating random wallet...'));
                        const wallet = this.generateRandomWallet();
                        const balance = await this.getBalance(wallet.address);
                        this.displayWalletInfo({
                            address: wallet.address,
                            mnemonic: wallet.mnemonic,
                            privateKey: this.exportPrivateKey(wallet.keypair),
                            balance
                        });
                        break;
                    }
                    case '2': {
                        const pattern = await this.askQuestion('\nEnter the pattern you want (hex characters only): ');
                        if (!/^[0-9a-fA-F]+$/.test(pattern)) {
                            console.log(chalk_1.default.red('Error: Pattern must contain only hexadecimal characters (0-9, a-f)'));
                            break;
                        }
                        if (pattern.length > 8) {
                            console.log(chalk_1.default.yellow('Warning: Long patterns may take a very long time to find!'));
                            const confirm = await this.askYesNo('Do you want to continue?');
                            if (!confirm)
                                break;
                        }
                        console.log('\nPosition options:');
                        console.log('1. Start of address');
                        console.log('2. End of address');
                        console.log('3. Anywhere in address');
                        const posChoice = await this.askQuestion('Choose position (1-3): ');
                        let position = 'start';
                        switch (posChoice) {
                            case '2':
                                position = 'end';
                                break;
                            case '3':
                                position = 'contains';
                                break;
                            default:
                                position = 'start';
                                break;
                        }
                        const result = await this.generateVanityAddress(pattern, position);
                        const balance = await this.getBalance(result.address);
                        this.displayWalletInfo({
                            address: result.address,
                            mnemonic: result.mnemonic,
                            privateKey: this.exportPrivateKey(result.keypair),
                            balance
                        });
                        console.log(chalk_1.default.blue(`\n📊 Generation Statistics:`));
                        console.log(chalk_1.default.white(`   Attempts: ${result.attempts.toLocaleString()}`));
                        break;
                    }
                    case '3': {
                        const mnemonic = await this.askQuestion('\nEnter your mnemonic phrase (12 or 24 words): ');
                        try {
                            const wallet = this.recoverFromMnemonic(mnemonic);
                            const balance = await this.getBalance(wallet.address);
                            console.log(chalk_1.default.green('\n✓ Wallet recovered successfully!'));
                            this.displayWalletInfo({
                                address: wallet.address,
                                privateKey: this.exportPrivateKey(wallet.keypair),
                                balance
                            });
                        }
                        catch (error) {
                            console.log(chalk_1.default.red(`\n❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
                            console.log(chalk_1.default.yellow('Make sure you entered a valid 12 or 24 word mnemonic phrase.'));
                        }
                        break;
                    }
                    default: {
                        console.log(chalk_1.default.red('\nInvalid option. Please choose 1, 2, or 3.'));
                        break;
                    }
                }
                console.log('\n');
                const continueChoice = await this.askYesNo('Would you like to perform another operation?');
                if (!continueChoice) {
                    console.log(chalk_1.default.blue('\nThank you for using Sui Vanity Wallet Generator!'));
                    console.log(chalk_1.default.gray('Stay safe and keep your keys secure! 🔐'));
                    break;
                }
            }
        }
        catch (error) {
            console.error(chalk_1.default.red(`\nFatal error: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
        finally {
            this.rl.close();
        }
    }
}
// Main execution
if (require.main === module) {
    const app = new SuiVanityWallet();
    app.run().catch(console.error);
}
exports.default = SuiVanityWallet;
