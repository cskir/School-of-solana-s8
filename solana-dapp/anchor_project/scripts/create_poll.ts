import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  createMint,
} from "@solana/spl-token";
import { AnchorProject } from "../target/types/anchor_project";

async function main() {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const program = anchor.workspace.anchor_project as Program<AnchorProject>;
    const wallet = provider.wallet as anchor.Wallet;

    const pollId = 1; 
    const question = "Have I ever revealed a secret to you?";

    const now = Math.floor(Date.now() / 1000);
    const startTs = now;
    const endTs = now + 15 * 24 * 60 * 60; 

    const [pollPda] = PublicKey.findProgramAddressSync(
    [
        Buffer.from("pollpoll"),             
        new BN(pollId).toArrayLike(Buffer, "le", 8),
    ],
    program.programId
    );

    console.log("Poll PDA:", pollPda.toBase58());

    const connection = provider.connection;
    const mintAuthority = wallet.publicKey;

    const votingMint = await createMint(
        connection,
        (wallet as any).payer, 
        mintAuthority,
        null,                  
        0                      
    );

    console.log("Voting mint:", votingMint.toBase58());

    await program.methods
        .initialize(
            new BN(pollId),
            question,
            new BN(startTs),
            new BN(endTs)
        )
        .accounts({
            admin: wallet.publicKey,
            poll: pollPda,
            votingMint,
            systemProgram: SystemProgram.programId,
        } as any)
        .rpc();

    console.log("Poll created on devnet");
    console.log("  poll_id:", pollId);
    console.log("  poll:", pollPda.toBase58());
    console.log("  voting_mint:", votingMint.toBase58());
}

main()
    .then(() => console.log("Done."))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });