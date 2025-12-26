/**
 * Hastrology Program Integration
 * 
 * This module provides helpers to interact with the Hastrology lottery program
 * on Solana.
 */

import { PublicKey, Connection, TransactionInstruction, SystemProgram } from '@solana/web3.js';
import BN from 'bn.js';

// New Program ID (deployed 2025-12-20)
export const PROGRAM_ID = new PublicKey('A3voJRWMzoy1118ZmTjsoYAGXrM9zPySUPwcgUQ3PV76');

// PDA Seeds
export const LOTTERY_STATE_SEED = Buffer.from('lottery_state');
export const POT_VAULT_SEED = Buffer.from('pot_vault');
export const USER_RECEIPT_SEED = Buffer.from('user-receipt');
export const USER_TICKET_SEED = Buffer.from('user-ticket');

// Instruction discriminators from IDL
// enter_lottery: [252, 72, 239, 78, 58, 56, 149, 231]
const ENTER_LOTTERY_DISCRIMINATOR = Buffer.from([252, 72, 239, 78, 58, 56, 149, 231]);

/**
 * Derive the LotteryState PDA
 */
export function getLotteryStatePDA(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync([LOTTERY_STATE_SEED], PROGRAM_ID);
}

/**
 * Derive the Pot Vault PDA
 */
export function getPotVaultPDA(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync([POT_VAULT_SEED], PROGRAM_ID);
}

/**
 * Derive the UserEntryReceipt PDA for a specific user and lottery
 */
export function getUserReceiptPDA(userPubkey: PublicKey, lotteryId: BN): [PublicKey, number] {
    const lotteryIdBuffer = lotteryId.toArrayLike(Buffer, 'le', 8);
    return PublicKey.findProgramAddressSync(
        [USER_RECEIPT_SEED, userPubkey.toBuffer(), lotteryIdBuffer],
        PROGRAM_ID
    );
}

/**
 * Derive the UserTicket PDA for a specific lottery and ticket number
 */
export function getUserTicketPDA(lotteryId: BN, ticketNumber: BN): [PublicKey, number] {
    const lotteryIdBuffer = lotteryId.toArrayLike(Buffer, 'le', 8);
    const ticketNumberBuffer = ticketNumber.toArrayLike(Buffer, 'le', 8);
    return PublicKey.findProgramAddressSync(
        [USER_TICKET_SEED, lotteryIdBuffer, ticketNumberBuffer],
        PROGRAM_ID
    );
}

/**
 * LotteryState account structure
 */
export interface LotteryState {
    authority: PublicKey;
    potVault: PublicKey;
    platformWallet: PublicKey;
    platformFeeBps: number;
    ticketPrice: BN;
    winner: BN;
    currentLotteryId: BN;
    totalParticipants: BN;
    isDrawing: boolean;
    lotteryEndtime: BN;
    commitSlot: BN;
    lotteryStateBump: number;
    potVaultBump: number;
}

/**
 * Decode LotteryState from account data
 */
export function decodeLotteryState(data: Buffer): LotteryState {
    let offset = 8; // Skip 8-byte discriminator

    const authority = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    const potVault = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    const platformWallet = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    const platformFeeBps = data.readUInt16LE(offset);
    offset += 2;

    const ticketPrice = new BN(data.slice(offset, offset + 8), 'le');
    offset += 8;

    const winner = new BN(data.slice(offset, offset + 8), 'le');
    offset += 8;

    const currentLotteryId = new BN(data.slice(offset, offset + 8), 'le');
    offset += 8;

    const totalParticipants = new BN(data.slice(offset, offset + 8), 'le');
    offset += 8;

    const isDrawing = data.readUInt8(offset) === 1;
    offset += 1;

    const lotteryEndtime = new BN(data.slice(offset, offset + 8), 'le');
    offset += 8;

    const commitSlot = new BN(data.slice(offset, offset + 8), 'le');
    offset += 8;

    const lotteryStateBump = data.readUInt8(offset);
    offset += 1;

    const potVaultBump = data.readUInt8(offset);

    return {
        authority,
        potVault,
        platformWallet,
        platformFeeBps,
        ticketPrice,
        winner,
        currentLotteryId,
        totalParticipants,
        isDrawing,
        lotteryEndtime,
        commitSlot,
        lotteryStateBump,
        potVaultBump,
    };
}

/**
 * Fetch and decode the LotteryState account
 */
export async function fetchLotteryState(connection: Connection): Promise<LotteryState | null> {
    const [lotteryStatePDA] = getLotteryStatePDA();
    const accountInfo = await connection.getAccountInfo(lotteryStatePDA);

    if (!accountInfo) {
        return null;
    }

    return decodeLotteryState(accountInfo.data as Buffer);
}

/**
 * Build the enter_lottery instruction
 * 
 * This creates the instruction to enter the lottery, which:
 * 1. Pays the ticket price (0.01 SOL) to the pot vault
 * 2. Creates a UserEntryReceipt PDA for this user + lottery
 * 3. Creates a UserTicket PDA for tracking
 */
export async function buildEnterLotteryInstruction(
    userPubkey: PublicKey,
    connection: Connection
): Promise<TransactionInstruction> {
    // Fetch lottery state to get current lottery ID and total participants
    const lotteryState = await fetchLotteryState(connection);

    if (!lotteryState) {
        throw new Error('Lottery not initialized');
    }

    if (lotteryState.isDrawing) {
        throw new Error('Lottery is currently drawing. Please try again later.');
    }

    const [lotteryStatePDA] = getLotteryStatePDA();
    const [potVaultPDA] = getPotVaultPDA();

    // Derive user receipt PDA
    const [userReceiptPDA] = getUserReceiptPDA(userPubkey, lotteryState.currentLotteryId);

    // Derive user ticket PDA (uses current total_participants as index)
    const [userTicketPDA] = getUserTicketPDA(lotteryState.currentLotteryId, lotteryState.totalParticipants);

    // Build the instruction
    // Anchor instruction format: [8-byte discriminator] + [serialized args]
    // enter_lottery has no args, so just the discriminator
    const data = ENTER_LOTTERY_DISCRIMINATOR;

    const keys = [
        { pubkey: userPubkey, isSigner: true, isWritable: true },
        { pubkey: lotteryStatePDA, isSigner: false, isWritable: true },
        { pubkey: potVaultPDA, isSigner: false, isWritable: true },
        { pubkey: userReceiptPDA, isSigner: false, isWritable: true },
        { pubkey: userTicketPDA, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];

    return new TransactionInstruction({
        keys,
        programId: PROGRAM_ID,
        data,
    });
}

/**
 * Check if a user has already entered the current lottery
 */
export async function hasUserEnteredLottery(
    connection: Connection,
    userPubkey: PublicKey
): Promise<boolean> {
    const lotteryState = await fetchLotteryState(connection);

    if (!lotteryState) {
        return false;
    }

    const [userReceiptPDA] = getUserReceiptPDA(userPubkey, lotteryState.currentLotteryId);
    const accountInfo = await connection.getAccountInfo(userReceiptPDA);

    return accountInfo !== null;
}
