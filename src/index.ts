#!/usr/bin/env node

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { fromBase64, toBase64 } from '@mysten/sui/utils';
import * as readline from 'readline';
import chalk from 'chalk';
import figlet from 'figlet';
import { HDKey } from '@scure/bip32';
import { bytesToHex } from '@noble/hashes/utils';

class SuiVanityWallet {
    private client: SuiClient;
    private rl: readline.Interface;

    constructor() {
        this.client = new SuiClient({ url: getFullnodeUrl('mainnet') });
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    private async displayHeader() {
        console.clear();
        console.log(chalk.cyan('═'.repeat(50)));
        console.log(chalk.cyan(figlet.textSync('SUI CLI', { 
            font: 'Small',
            horizontalLayout: 'fitted'
        })));
        console.log(chalk.blue('    Sui Vanity Wallet Generator'));
        console.log(chalk.cyan('═'.repeat(50)));
        console.log();
    }

    private async displayMenu() {
        console.log(chalk.white('What would you like to do?'));
        console.log(chalk.yellow('1.') + ' Generate a random wallet');
        console.log(chalk.yellow('2.') + ' Generate a vanity address');
        console.log(chalk.yellow('3.') + ' Recover wallet from mnemonic');
        console.log();
        process.stdout.write(chalk.magenta('Enter option (1-3): '));
    }

    private generateRandomWallet(): { keypair: Ed25519Keypair, mnemonic: string, address: string } {
        const mnemonic = bip39.generateMnemonic(wordlist);
        return this.generateWalletFromMnemonic(mnemonic);
    }

    private generateWalletFromMnemonic(mnemonic: string): { keypair: Ed25519Keypair, mnemonic: string, address: string } {
        if (!bip39.validateMnemonic(mnemonic, wordlist)) {
            throw new Error('Invalid mnemonic phrase');
        }

        const seed = bip39.mnemonicToSeedSync(mnemonic);
        const hdKey = HDKey.fromMasterSeed(seed);
        const suiPath = `m/44'/784'/0'/0'/0'`;
        const derived = hdKey.derive(suiPath);
        
        if (!derived.privateKey) {
            throw new Error('Failed to derive key from mnemonic');
        }

        const keypair = Ed25519Keypair.fromSecretKey(derived.privateKey);
        const address = keypair.getPublicKey().toSuiAddress();

        return { keypair, mnemonic, address };
    }

    private async generateVanityAddress(pattern: string, position: 'start' | 'end' | 'contains' = 'start'): Promise<{ keypair: Ed25519Keypair, mnemonic: string, address: string, attempts: number }> {
        let attempts = 0;
        const startTime = Date.now();
        
        console.log(chalk.blue(`\nSearching for address ${position === 'start' ? 'starting with' : position === 'end' ? 'ending with' : 'containing'} "${pattern}"...`));
        console.log(chalk.gray('This may take a while depending on the pattern complexity.\n'));

        while (true) {
            attempts++;
            const { keypair, mnemonic, address } = this.generateRandomWallet();
            const addressWithoutPrefix = address.slice(2).toLowerCase();
            const lowerPattern = pattern.toLowerCase();
            
            let matches = false;
            if (position === 'start') {
                matches = addressWithoutPrefix.startsWith(lowerPattern);
            } else if (position === 'end') {
                matches = addressWithoutPrefix.endsWith(lowerPattern);
            } else {
                matches = addressWithoutPrefix.includes(lowerPattern);
            }
            
            if (matches) {
                const elapsed = (Date.now() - startTime) / 1000;
                console.log(chalk.green(`\n✓ Found matching address after ${attempts} attempts in ${elapsed.toFixed(2)}s!`));
                return { keypair, mnemonic, address, attempts };
            }
            
            if (attempts % 1000 === 0) {
                const elapsed = (Date.now() - startTime) / 1000;
                const rate = attempts / elapsed;
                process.stdout.write(`\r${chalk.yellow(`Attempts: ${attempts.toLocaleString()} | Rate: ${rate.toFixed(0)}/s | Time: ${elapsed.toFixed(1)}s`)}`);
            }
        }
    }

    private recoverFromMnemonic(mnemonic: string): { keypair: Ed25519Keypair, address: string } {
        return this.generateWalletFromMnemonic(mnemonic);
    }

    private async getBalance(address: string): Promise<string> {
        try {
            const balance = await this.client.getBalance({ owner: address });
            const suiBalance = parseInt(balance.totalBalance) / 1_000_000_000;
            return suiBalance.toFixed(4);
        } catch (error) {
            return 'Error fetching balance';
        }
    }

    private displayWalletInfo(wallet: { address: string, mnemonic?: string, privateKey?: string, balance?: string }) {
        console.log(chalk.cyan('\n═'.repeat(70)));
        console.log(chalk.green.bold('                    WALLET GENERATED'));
        console.log(chalk.cyan('═'.repeat(70)));
        
        console.log(chalk.white.bold('\n📍 Address:'));
        console.log(chalk.green('   ' + wallet.address));
        
        if (wallet.mnemonic) {
            console.log(chalk.white.bold('\n🔑 Mnemonic Phrase:'));
            console.log(chalk.yellow('   ' + wallet.mnemonic));
        }
        
        if (wallet.privateKey) {
            console.log(chalk.white.bold('\n🔐 Private Key:'));
            console.log(chalk.red('   ' + wallet.privateKey));
        }
        
        if (wallet.balance) {
            console.log(chalk.white.bold('\n💰 Balance:'));
            console.log(chalk.green('   ' + wallet.balance + ' SUI'));
        }
        
        console.log(chalk.cyan('\n═'.repeat(70)));
        console.log(chalk.red.bold('⚠️  SECURITY WARNING:'));
        console.log(chalk.red('   Keep your mnemonic and private key safe and secret!'));
        console.log(chalk.red('   Never share them with anyone or store them online!'));
        console.log(chalk.cyan('═'.repeat(70)));
    }

    private async askQuestion(question: string): Promise<string> {
        return new Promise((resolve) => {
            this.rl.question(question, (answer) => {
                resolve(answer.trim());
            });
        });
    }

    private async askYesNo(question: string): Promise<boolean> {
        const answer = await this.askQuestion(question + ' (y/n): ');
        return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
    }

    private exportPrivateKey(keypair: Ed25519Keypair): string {
        const secretKey = keypair.getSecretKey();
        const secretKeyArray = typeof secretKey === 'string' ? Buffer.from(secretKey, 'base64') : new Uint8Array(secretKey);
        return toBase64(secretKeyArray);
    }

    async run() {
        try {
            while (true) {
                await this.displayHeader();
                await this.displayMenu();
                
                const choice = await this.askQuestion('');
                
                switch (choice) {
                    case '1': {
                        console.log(chalk.blue('\nGenerating random wallet...'));
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
                            console.log(chalk.red('Error: Pattern must contain only hexadecimal characters (0-9, a-f)'));
                            break;
                        }
                        
                        if (pattern.length > 8) {
                            console.log(chalk.yellow('Warning: Long patterns may take a very long time to find!'));
                            const confirm = await this.askYesNo('Do you want to continue?');
                            if (!confirm) break;
                        }
                        
                        console.log('\nPosition options:');
                        console.log('1. Start of address');
                        console.log('2. End of address');
                        console.log('3. Anywhere in address');
                        
                        const posChoice = await this.askQuestion('Choose position (1-3): ');
                        let position: 'start' | 'end' | 'contains' = 'start';
                        
                        switch (posChoice) {
                            case '2': position = 'end'; break;
                            case '3': position = 'contains'; break;
                            default: position = 'start'; break;
                        }
                        
                        const result = await this.generateVanityAddress(pattern, position);
                        const balance = await this.getBalance(result.address);
                        
                        this.displayWalletInfo({
                            address: result.address,
                            mnemonic: result.mnemonic,
                            privateKey: this.exportPrivateKey(result.keypair),
                            balance
                        });
                        
                        console.log(chalk.blue(`\n📊 Generation Statistics:`));
                        console.log(chalk.white(`   Attempts: ${result.attempts.toLocaleString()}`));
                        break;
                    }
                    
                    case '3': {
                        const mnemonic = await this.askQuestion('\nEnter your mnemonic phrase (12 or 24 words): ');
                        
                        try {
                            const wallet = this.recoverFromMnemonic(mnemonic);
                            const balance = await this.getBalance(wallet.address);
                            
                            console.log(chalk.green('\n✓ Wallet recovered successfully!'));
                            
                            this.displayWalletInfo({
                                address: wallet.address,
                                privateKey: this.exportPrivateKey(wallet.keypair),
                                balance
                            });
                        } catch (error) {
                            console.log(chalk.red(`\n❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
                            console.log(chalk.yellow('Make sure you entered a valid 12 or 24 word mnemonic phrase.'));
                        }
                        break;
                    }
                    
                    default: {
                        console.log(chalk.red('\nInvalid option. Please choose 1, 2, or 3.'));
                        break;
                    }
                }
                
                console.log('\n');
                const continueChoice = await this.askYesNo('Would you like to perform another operation?');
                if (!continueChoice) {
                    console.log(chalk.blue('\nThank you for using Sui Vanity Wallet Generator!'));
                    console.log(chalk.gray('Stay safe and keep your keys secure! 🔐'));
                    break;
                }
            }
        } catch (error) {
            console.error(chalk.red(`\nFatal error: ${error instanceof Error ? error.message : 'Unknown error'}`));
        } finally {
            this.rl.close();
        }
    }
}

// Main execution
if (require.main === module) {
    const app = new SuiVanityWallet();
    app.run().catch(console.error);
}

export default SuiVanityWallet;