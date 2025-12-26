/**
 * Script to read the LotteryState account from the deployed Hastrology program
 * 
 * Run with: node scripts/check_lottery_state.js
 */

const { Connection, PublicKey } = require('@solana/web3.js');

// Program ID - NEW PROGRAM
const PROGRAM_ID = new PublicKey('A3voJRWMzoy1118ZmTjsoYAGXrM9zPySUPwcgUQ3PV76');
const LOTTERY_STATE_SEED = Buffer.from('lottery_state');

async function main() {
    // Connect to devnet
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

    // Derive LotteryState PDA
    const [lotteryStatePDA] = PublicKey.findProgramAddressSync(
        [LOTTERY_STATE_SEED],
        PROGRAM_ID
    );

    console.log('='.repeat(60));
    console.log('HASTROLOGY LOTTERY STATE CHECK');
    console.log('='.repeat(60));
    console.log('Program ID:', PROGRAM_ID.toBase58());
    console.log('LotteryState PDA:', lotteryStatePDA.toBase58());
    console.log('');

    // Fetch the account
    const accountInfo = await connection.getAccountInfo(lotteryStatePDA);

    if (!accountInfo) {
        console.log('❌ LotteryState account NOT FOUND!');
        console.log('   The program needs to be initialized first.');
        console.log('');
        console.log('   Run the initialize instruction with:');
        console.log('   - platform_wallet_pubkey: Your treasury wallet');
        console.log('   - ticket_price: 10000000 (0.01 SOL in lamports)');
        console.log('   - platform_fee_bps: e.g., 500 (5%)');
        console.log('   - first_lottery_endtime: Unix timestamp for lottery end');
        return;
    }

    console.log('✅ LotteryState account FOUND!');
    console.log('   Owner:', accountInfo.owner.toBase58());
    console.log('   Data length:', accountInfo.data.length, 'bytes');
    console.log('');

    // Decode the account data manually
    // LotteryState structure (from Rust):
    // - authority: Pubkey (32 bytes)
    // - pot_vault: Pubkey (32 bytes)
    // - platform_wallet: Pubkey (32 bytes)
    // - platform_fee_bps: u16 (2 bytes)
    // - ticket_price: u64 (8 bytes)
    // - winner: u64 (8 bytes)
    // - current_lottery_id: u64 (8 bytes)
    // - total_participants: u64 (8 bytes)
    // - is_drawing: bool (1 byte)
    // - lottery_endtime: i64 (8 bytes)
    // - commit_slot: u64 (8 bytes)
    // - lottery_state_bump: u8 (1 byte)
    // - pot_vault_bump: u8 (1 byte)

    const data = accountInfo.data;

    // Skip 8-byte discriminator (Anchor account discriminator)
    let offset = 8;

    // Read authority (32 bytes)
    const authority = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    // Read pot_vault (32 bytes)
    const potVault = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    // Read platform_wallet (32 bytes)
    const platformWallet = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    // Read platform_fee_bps (u16 - 2 bytes, little-endian)
    const platformFeeBps = data.readUInt16LE(offset);
    offset += 2;

    // Read ticket_price (u64 - 8 bytes, little-endian)
    const ticketPrice = data.readBigUInt64LE(offset);
    offset += 8;

    // Read winner (u64 - 8 bytes)
    const winner = data.readBigUInt64LE(offset);
    offset += 8;

    // Read current_lottery_id (u64 - 8 bytes)
    const currentLotteryId = data.readBigUInt64LE(offset);
    offset += 8;

    // Read total_participants (u64 - 8 bytes)
    const totalParticipants = data.readBigUInt64LE(offset);
    offset += 8;

    // Read is_drawing (bool - 1 byte)
    const isDrawing = data.readUInt8(offset) === 1;
    offset += 1;

    // Read lottery_endtime (i64 - 8 bytes)
    const lotteryEndtime = data.readBigInt64LE(offset);
    offset += 8;

    // Read commit_slot (u64 - 8 bytes)
    const commitSlot = data.readBigUInt64LE(offset);
    offset += 8;

    // Read bumps
    const lotteryStateBump = data.readUInt8(offset);
    offset += 1;
    const potVaultBump = data.readUInt8(offset);

    // Display the values
    console.log('LOTTERY STATE VALUES:');
    console.log('-'.repeat(60));
    console.log('Authority:', authority.toBase58());
    console.log('Pot Vault:', potVault.toBase58());
    console.log('Platform Wallet:', platformWallet.toBase58());
    console.log('Platform Fee (bps):', platformFeeBps, `(${platformFeeBps / 100}%)`);
    console.log('');
    console.log('Ticket Price:', ticketPrice.toString(), 'lamports', `(${Number(ticketPrice) / 1e9} SOL)`);
    console.log('');
    console.log('Current Lottery ID:', currentLotteryId.toString());
    console.log('Total Participants:', totalParticipants.toString());
    console.log('Winner:', winner.toString());
    console.log('Is Drawing:', isDrawing);
    console.log('');

    // Parse lottery endtime
    const endtimeDate = new Date(Number(lotteryEndtime) * 1000);
    const now = new Date();
    console.log('Lottery Endtime:', lotteryEndtime.toString(), `(${endtimeDate.toISOString()})`);
    console.log('Current Time:', Math.floor(now.getTime() / 1000), `(${now.toISOString()})`);

    if (endtimeDate < now) {
        console.log('⚠️  WARNING: Lottery has ended! Endtime is in the past.');
    } else {
        const diff = endtimeDate - now;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        console.log(`✅ Lottery is active! Ends in ${hours}h ${minutes}m`);
    }

    console.log('');
    console.log('Commit Slot:', commitSlot.toString());
    console.log('LotteryState Bump:', lotteryStateBump);
    console.log('Pot Vault Bump:', potVaultBump);
    console.log('');
    console.log('='.repeat(60));

    // Validation checks
    console.log('VALIDATION:');
    console.log('-'.repeat(60));

    // Check ticket price
    if (ticketPrice === 10000000n) {
        console.log('✅ Ticket price is correctly set to 0.01 SOL');
    } else {
        console.log(`⚠️  Ticket price is ${Number(ticketPrice) / 1e9} SOL (expected 0.01 SOL)`);
    }

    // Check platform wallet
    const isDefaultPubkey = platformWallet.toBase58() === '11111111111111111111111111111111';
    if (isDefaultPubkey) {
        console.log('❌ Platform wallet is the default/system pubkey - needs to be set!');
    } else {
        console.log('✅ Platform wallet is set to:', platformWallet.toBase58());
    }

    // Check lottery endtime
    if (Number(lotteryEndtime) === 0) {
        console.log('❌ Lottery endtime is 0 - needs to be set!');
    } else if (endtimeDate < now) {
        console.log('⚠️  Lottery endtime is in the past - may need reset');
    } else {
        console.log('✅ Lottery endtime is valid and in the future');
    }

    console.log('='.repeat(60));
}

main().catch(console.error);
