/**
 * Script to execute the lottery draw and payout
 * 
 * Run with: yarn ts-node scripts/execute_draw.ts
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import BN from "bn.js";
import { PublicKey, SystemProgram, ComputeBudgetProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";

// MagicBlock Ephemeral VRF Devnet Queue
const VRF_QUEUE = new PublicKey("Cuj97ggrhhidhbu39TijNVqE74xvKJ69gDervRUXAxGh");

async function main() {
    // Configure the client to use devnet
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const program = anchor.workspace.hastrologyProgram;
    const connection = provider.connection;

    console.log("=".repeat(60));
    console.log("HASTROLOGY LOTTERY DRAW EXECUTION");
    console.log("=".repeat(60));

    // Derive PDAs
    const [lotteryStatePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("lottery_state")],
        program.programId
    );
    const [potVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("pot_vault")],
        program.programId
    );

    // Fetch State
    let state = await program.account.lotteryState.fetch(lotteryStatePda);
    console.log(`Current Lottery ID: ${state.currentLotteryId.toString()}`);
    console.log(`Participants: ${state.totalParticipants.toString()}`);
    console.log(`Endtime: ${new Date(Number(state.lotteryEndtime) * 1000).toISOString()}`);

    // Check if ready to draw
    const now = Math.floor(Date.now() / 1000);
    if (now < Number(state.lotteryEndtime)) {
        console.log("❌ Lottery endtime has not passed yet!");
        console.log(`   Wait until ${new Date(Number(state.lotteryEndtime) * 1000).toISOString()}`);
        return;
    }

    if (Number(state.totalParticipants) === 0) {
        console.log("❌ No participants in this lottery.");
        return;
    }

    console.log("\n1. Requesting Randomness Draw...");

    try {
        const sig = await program.methods
            .requestDraw()
            .accounts({
                authority: provider.wallet.publicKey,
                lotteryState: lotteryStatePda,
                oracleQueue: VRF_QUEUE,
            })
            .rpc();

        console.log("✅ Draw Requested! Signature:", sig);
        console.log("   Waiting for VRF callback (this typically takes 10-20 seconds)...");

    } catch (e: any) {
        console.log("⚠️  Request Draw failed (maybe already requested?):", e.message);
    }

    // Poll for winner
    console.log("\n2. Polling for Winner Resolution...");
    let winnerIndex = 0;

    for (let i = 0; i < 30; i++) { // Try for ~60 seconds
        process.stdout.write(".");
        await new Promise(r => setTimeout(r, 2000));

        state = await program.account.lotteryState.fetch(lotteryStatePda);

        if (Number(state.winner) > 0) {
            winnerIndex = Number(state.winner);
            console.log("\n✅ Winner Selected! Ticket Index:", winnerIndex);
            break;
        }
    }

    if (winnerIndex === 0) {
        console.log("\n❌ Timed out waiting for winner resolution. Check back later.");
        return;
    }

    // Payout
    console.log("\n3. Executing Payout...");

    const currentLotteryId = state.currentLotteryId;

    // Derive Winning Ticket PDA
    const [winningTicketPda] = PublicKey.findProgramAddressSync(
        [
            Buffer.from("user-ticket"),
            currentLotteryId.toArrayLike(Buffer, "le", 8),
            new BN(winnerIndex).toArrayLike(Buffer, "le", 8),
        ],
        program.programId
    );

    // Fetch Winning Ticket to get User Address
    const ticketAccount = await program.account.userTicket.fetch(winningTicketPda);
    const winnerPubkey = ticketAccount.user;

    console.log("   Winner Address:", winnerPubkey.toBase58());

    try {
        const payoutSig = await program.methods
            .payout()
            .accounts({
                authority: provider.wallet.publicKey,
                lotteryState: lotteryStatePda,
                potVault: potVaultPda,
                platformWallet: state.platformWallet,
                winningTicket: winningTicketPda,
                winner: winnerPubkey,
                systemProgram: SystemProgram.programId,
            })
            .preInstructions([
                ComputeBudgetProgram.setComputeUnitPrice({
                    microLamports: 5000,
                })
            ])
            .rpc();

        console.log("✅ Payout Successful! Signature:", payoutSig);
        console.log("   Prize transferred to winner.");
        console.log("   Lottery Reset for next round.");

    } catch (e: any) {
        console.log("❌ Payout Failed:", e.message);
    }

    console.log("=".repeat(60));
}

main().catch(console.error);
