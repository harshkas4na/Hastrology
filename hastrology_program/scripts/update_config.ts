/**
 * Script to update the lottery configuration
 * 
 * This script calls the update_config instruction to set:
 * - ticket_price: 0.01 SOL (10,000,000 lamports)
 * - lottery_endtime: End of today (midnight UTC)
 * 
 * Prerequisites:
 * 1. Program must be built with: anchor build
 * 2. Program must be deployed with: anchor deploy
 * 3. Your wallet must be the authority (Dv8EZLYymKDdXnnTuw2M1MD31TjVru5kpnhrk8Ki6wth)
 * 
 * Run with: npx ts-node scripts/update_config.ts
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import BN from "bn.js";
import { PublicKey, LAMPORTS_PER_SOL, ComputeBudgetProgram } from "@solana/web3.js";

async function main() {
    // Configure the client to use devnet fallback if environment variables are missing
    if (!process.env.ANCHOR_PROVIDER_URL) {
        process.env.ANCHOR_PROVIDER_URL = "https://api.devnet.solana.com";
    }
    if (!process.env.ANCHOR_WALLET) {
        process.env.ANCHOR_WALLET = process.env.HOME + "/.config/solana/id.json";
    }

    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const program = anchor.workspace.hastrologyProgram as Program<any>;

    // Derive LotteryState PDA
    const [lotteryStatePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("lottery_state")],
        program.programId
    );

    console.log("=".repeat(60));
    console.log("HASTROLOGY CONFIG UPDATE");
    console.log("=".repeat(60));
    console.log("Program ID:", program.programId.toBase58());
    console.log("LotteryState PDA:", lotteryStatePda.toBase58());
    console.log("Authority (your wallet):", provider.wallet.publicKey.toBase58());
    console.log("");

    // Fetch current state
    const stateBefore = await program.account["lotteryState"].fetch(lotteryStatePda);

    console.log("CURRENT CONFIG:");
    console.log("-".repeat(60));
    console.log("Authority:", stateBefore.authority.toBase58());
    console.log("Ticket Price:", stateBefore.ticketPrice.toString(), "lamports",
        `(${Number(stateBefore.ticketPrice) / LAMPORTS_PER_SOL} SOL)`);
    console.log("Lottery Endtime:", stateBefore.lotteryEndtime.toString(),
        `(${new Date(Number(stateBefore.lotteryEndtime) * 1000).toISOString()})`);
    console.log("");

    // Check if caller is authority
    if (!stateBefore.authority.equals(provider.wallet.publicKey)) {
        console.log("❌ ERROR: Your wallet is not the authority!");
        console.log("   Required authority:", stateBefore.authority.toBase58());
        console.log("   Your wallet:", provider.wallet.publicKey.toBase58());
        return;
    }

    // New values
    const newTicketPrice = new BN(LAMPORTS_PER_SOL / 100); // 0.01 SOL = 10,000,000 lamports

    // Set lottery endtime to next midnight IST
    // IST is UTC+5:30, so midnight IST = 18:30 UTC previous day
    const now = new Date();
    // IST is UTC + 5:30
    const IST_OFFSET = (5 * 60 + 30) * 60 * 1000;
    const nowIST = new Date(now.getTime() + IST_OFFSET);

    // Create a date for tomorrow 00:00:00 in IST
    const tomorrowIST = new Date(nowIST);
    tomorrowIST.setUTCDate(tomorrowIST.getUTCDate() + 1);
    tomorrowIST.setUTCHours(0, 0, 0, 0);

    // Convert back to UTC by subtracting the offset
    const tomorrowMidnightISTinUTC = new Date(tomorrowIST.getTime() - IST_OFFSET);
    const newLotteryEndtime = new BN(Math.floor(tomorrowMidnightISTinUTC.getTime() / 1000));

    console.log("NEW CONFIG TO SET:");
    console.log("-".repeat(60));
    console.log("New Ticket Price:", newTicketPrice.toString(), "lamports",
        `(${Number(newTicketPrice) / LAMPORTS_PER_SOL} SOL)`);
    console.log("New Lottery Endtime:", newLotteryEndtime.toString(),
        `(${new Date(Number(newLotteryEndtime) * 1000).toISOString()})`);
    console.log("");

    // Call update_config
    console.log("Sending update_config transaction...");

    try {
        const sig = await program.methods
            .updateConfig(
                newTicketPrice,           // new_ticket_price
                null,                     // new_platform_fee_bps (keep current)
                null,                     // new_platform_wallet (keep current)
                newLotteryEndtime,        // new_lottery_endtime
                null,                     // reset_winner
                null                      // reset_drawing
            )
            .accountsStrict({
                authority: provider.wallet.publicKey,
                lotteryState: lotteryStatePda,
            })
            .preInstructions([
                ComputeBudgetProgram.setComputeUnitPrice({
                    microLamports: 5000,
                })
            ])
            .rpc();

        console.log("✅ Transaction successful!");
        console.log("   Signature:", sig);
        console.log("");

        // Verify the update
        const stateAfter = await program.account["lotteryState"].fetch(lotteryStatePda);

        console.log("UPDATED CONFIG:");
        console.log("-".repeat(60));
        console.log("Ticket Price:", stateAfter.ticketPrice.toString(), "lamports",
            `(${Number(stateAfter.ticketPrice) / LAMPORTS_PER_SOL} SOL)`);
        console.log("Lottery Endtime:", stateAfter.lotteryEndtime.toString(),
            `(${new Date(Number(stateAfter.lotteryEndtime) * 1000).toISOString()})`);

        if (stateAfter.ticketPrice.eq(newTicketPrice)) {
            console.log("✅ Ticket price updated correctly!");
        } else {
            console.log("❌ Ticket price update failed!");
        }

        if (stateAfter.lotteryEndtime.eq(newLotteryEndtime)) {
            console.log("✅ Lottery endtime updated correctly!");
        } else {
            console.log("❌ Lottery endtime update failed!");
        }

    } catch (error: any) {
        console.log("❌ Transaction failed!");
        console.log("   Error:", error.message);

        if (error.logs) {
            console.log("\nProgram Logs:");
            error.logs.forEach((log: string) => console.log("  ", log));
        }
    }

    console.log("=".repeat(60));
}

main().catch(console.error);
