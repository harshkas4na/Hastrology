
// Simulate keypair and Vercel env
process.env.VERCEL = '1';
process.env.LOTTERY_AUTHORITY_KEYPAIR = '[1,2,3]'; // Minimal valid JSON for logic check
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = 'mock-key';

// Mock dependencies
const mockLogger = {
    info: console.log,
    warn: console.warn,
    error: console.error
};

const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function (path) {
    if (path.includes('config/logger')) return mockLogger;

    // We want to verify the scheduler actually finds the file and tries to use it.
    // So we DON'T mock the scheduler service itself, we let it run.
    // But we mock things it depends on that would crash in isolation (like Solana connection)

    if (path === '@solana/web3.js') {
        return {
            Connection: class { },
            PublicKey: class { constructor() { } toBase58() { return 'mock-pubkey'; } },
            Keypair: { fromSecretKey: () => ({ publicKey: { toBase58: () => 'mock-pubkey' } }) }
        };
    }
    if (path === '@coral-xyz/anchor') {
        return {
            AnchorProvider: class { },
            Program: class { }
        };
    }

    return originalRequire.apply(this, arguments);
};

// Override fs.readFileSync just for the keypair read if it tries to read file, 
// but our env var is an array so it shouldn't read file for keypair.
// It SHOULD read file for IDL. We want to ensure it reads the NEW path.
const fs = require('fs');
const originalRead = fs.readFileSync;
fs.readFileSync = function (path, encoding) {
    if (path.includes('hastrology_program.json')) {
        console.log('VERIFICATION: Accessing IDL at', path);
    }
    return originalRead.apply(this, arguments);
};

try {
    const lotteryScheduler = require('./src/services/lottery-scheduler.service');
    // We expect it to try to load the bundled IDL
    lotteryScheduler.initialize(process.env.LOTTERY_AUTHORITY_KEYPAIR);

    if (lotteryScheduler.isInitialized) {
        console.log('SUCCESS: Scheduler initialized with bundled IDL');
    } else {
        console.log('FAILURE: Scheduler failed to initialize. Error:', lotteryScheduler.initializationError);
    }

} catch (e) {
    console.error('Test crashed:', e);
}
