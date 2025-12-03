import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import {
    PublicKey,
} from "@solana/web3.js";
import {
    getOrCreateAssociatedTokenAccount,
    TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { AnchorProject } from "../target/types/anchor_project";


const VOTERS: string[] = [
    "HHdMBZ3NiQQAMg2B4ePHjVPEeLD3hXZrciYBFoGC8y4V",
    "A3TAry5AdY5dGwYQsnhh1C9n8qWBZ3GqnyE3LXDp7w1u",
    "7CxfRRRLJgvBH2KS11Ds8p5igqP5o4x8WSsKHTwsn9rK",
];

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

    const pollAccount = await program.account.poll.fetch(pollPda);
    const votingMint = pollAccount.votingMint as PublicKey;

    console.log("Voting mint from poll:", votingMint.toBase58());

    for (const voterStr of VOTERS) {
    const voterPubkey = new PublicKey(voterStr);

    const ata = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        (wallet as any).payer,
        votingMint,
        voterPubkey
    );

    console.log(`Minting pass to voter: ${voterPubkey.toBase58()}`);
    console.log(`  Voter pass token account: ${ata.address.toBase58()}`);

    await program.methods
        .mintPass()
        .accounts({
        admin: wallet.publicKey,
        poll: pollPda,
        votingMint,
        voterPassTokenAccount: ata.address,
        voter: voterPubkey,
        tokenProgram: TOKEN_PROGRAM_ID,
        } as any )
        .rpc();
    }

    console.log("Minting passes done.");
}

main()
  .then(() => console.log("Done."))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
