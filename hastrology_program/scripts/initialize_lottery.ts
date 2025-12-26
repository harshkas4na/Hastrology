/**
 * Script to initialize the Hastrology lottery program
 * 
 * Run with: yarn ts-node scripts/initialize_lottery.ts
 */

import * as anchor from "@coral-xyz/anchor";
import BN from "bn.js";
import { PublicKey, LAMPORTS_PER_SOL, SystemProgram, ComputeBudgetProgram } from "@solana/web3.js";

async function main() {
    // Configure the client to use devnet
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const program = anchor.workspace.hastrologyProgram;

    // Derive PDAs
    const [lotteryStatePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("lottery_state")],
        program.programId
    );

    const [potVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("pot_vault")],
        program.programId
    );

    console.log("=".repeat(60));
    console.log("HASTROLOGY LOTTERY INITIALIZATION");
    console.log("=".repeat(60));
    console.log("Program ID:", program.programId.toBase58());
    console.log("Authority (your wallet):", provider.wallet.publicKey.toBase58());
    console.log("LotteryState PDA:", lotteryStatePda.toBase58());
    console.log("Pot Vault PDA:", potVaultPda.toBase58());
    console.log("");

    // Check if already initialized
    const existingAccount = await provider.connection.getAccountInfo(lotteryStatePda);
    if (existingAccount) {
        console.log("⚠️  LotteryState already exists!");
        console.log("   Fetching current state...");

        const state = await program.account.lotteryState.fetch(lotteryStatePda);
        console.log("");
        console.log("Current Config:");
        console.log("  Authority:", state.authority.toBase58());
        console.log("  Platform Wallet:", state.platformWallet.toBase58());
        console.log("  Ticket Price:", Number(state.ticketPrice) / LAMPORTS_PER_SOL, "SOL");
        console.log("  Platform Fee:", state.platformFeeBps, "bps");
        console.log("  Lottery ID:", state.currentLotteryId.toString());
        return;
    }

    // Initialize parameters
    const platformWallet = provider.wallet.publicKey; // Use your wallet as platform wallet
    const ticketPrice = new BN(LAMPORTS_PER_SOL / 100); // 0.01 SOL
    const platformFeeBps = 100; // 1%

    // Set lottery endtime to end of today (midnight UTC tomorrow)
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    const firstLotteryEndtime = new BN(Math.floor(tomorrow.getTime() / 1000));

    console.log("INITIALIZATION PARAMETERS:");
    console.log("-".repeat(60));
    console.log("Platform Wallet:", platformWallet.toBase58());
    console.log("Ticket Price:", Number(ticketPrice) / LAMPORTS_PER_SOL, "SOL", `(${ticketPrice.toString()} lamports)`);
    console.log("Platform Fee:", platformFeeBps, "bps", `(${platformFeeBps / 100}%)`);
    console.log("Lottery Endtime:", firstLotteryEndtime.toString(),
        `(${new Date(Number(firstLotteryEndtime) * 1000).toISOString()})`);
    console.log("");

    console.log("Sending initialize transaction...");

    try {
        const sig = await program.methods
            .initialize(
                platformWallet,
                ticketPrice,
                platformFeeBps,
                firstLotteryEndtime
            )
            .accountsStrict({
                authority: provider.wallet.publicKey,
                lotteryState: lotteryStatePda,
                potVault: potVaultPda,
                systemProgram: SystemProgram.programId,
            })
            .preInstructions([
                ComputeBudgetProgram.setComputeUnitPrice({
                    microLamports: 5000,
                })
            ])
            .rpc();

        console.log("✅ Initialization successful!");
        console.log("   Signature:", sig);
        console.log("");

        // Verify the initialization
        const state = await program.account.lotteryState.fetch(lotteryStatePda);

        console.log("INITIALIZED CONFIG:");
        console.log("-".repeat(60));
        console.log("Authority:", state.authority.toBase58());
        console.log("Platform Wallet:", state.platformWallet.toBase58());
        console.log("Ticket Price:", Number(state.ticketPrice) / LAMPORTS_PER_SOL, "SOL");
        console.log("Platform Fee:", state.platformFeeBps, "bps");
        console.log("Lottery ID:", state.currentLotteryId.toString());
        console.log("Total Participants:", state.totalParticipants.toString());
        console.log("Lottery Endtime:", new Date(Number(state.lotteryEndtime) * 1000).toISOString());

        console.log("");
        console.log("✅ Program is ready to use!");
        console.log("   Users can now enter the lottery by calling enter_lottery");

    } catch (error: any) {
        console.log("❌ Initialization failed!");
        console.log("   Error:", error.message);

        if (error.logs) {
            console.log("\nProgram Logs:");
            error.logs.forEach((log: string) => console.log("  ", log));
        }
    }

    console.log("=".repeat(60));
}

main().catch(console.error);
