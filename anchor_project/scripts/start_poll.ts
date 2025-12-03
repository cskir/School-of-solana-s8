import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { AnchorProject } from "../target/types/anchor_project";

async function main() {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const program = anchor.workspace.anchor_project as Program<AnchorProject>;
    const wallet = provider.wallet as anchor.Wallet;

    const pollId = 1; 

    const [pollPda] = PublicKey.findProgramAddressSync(
    [
        Buffer.from("pollpoll"),
        new BN(pollId).toArrayLike(Buffer, "le", 8),
    ],
    program.programId
    );

    console.log("Poll PDA:", pollPda.toBase58());

    await program.methods
    .start()
    .accounts({
        admin: wallet.publicKey,
        poll: pollPda,
    })
    .rpc();

    console.log("Poll started (is_active = true)");
}

main()
  .then(() => console.log("Done."))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });