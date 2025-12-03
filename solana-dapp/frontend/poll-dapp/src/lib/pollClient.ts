// src/lib/pollClient.ts
"use client";

import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { usePollProgram } from "./usePollProgram";

export type PollAccount = {
  admin: PublicKey;
  pollId: anchor.BN;
  question: string;
  startTs: anchor.BN;
  endTs: anchor.BN;
  isActive: boolean;
  votingMint: PublicKey;
  totalYes: anchor.BN;
  totalNo: anchor.BN;
};

export function usePollClient(pollId: number) {
  const { program, wallet, PROGRAM_ID } = usePollProgram();

  async function derivePollPda(): Promise<PublicKey> {
    if (!program) throw new Error("Program not ready");

    const [pollPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("pollpoll"),
        new anchor.BN(pollId).toArrayLike(Buffer, "le", 8),
      ],
      PROGRAM_ID
    );
    return pollPda;
  }

  async function deriveVoterStatePda(pollPda: PublicKey): Promise<PublicKey> {
    if (!wallet.publicKey) throw new Error("Wallet not connected");
    if (!program) throw new Error("Program not ready");

    const [voterStatePda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("voter_state"),
        pollPda.toBuffer(),
        wallet.publicKey.toBuffer(),
      ],
      PROGRAM_ID
    );

    return voterStatePda;
  }

  async function loadPoll(): Promise<{ pollPda: PublicKey; poll: PollAccount }> {
    if (!program) throw new Error("Program not ready");

    const pollPda = await derivePollPda();
    const poll = (await (program as any).account.poll.fetch(pollPda)) as PollAccount;

    return { pollPda, poll };
  }

  async function addVoter(pollPda: PublicKey): Promise<PublicKey> {
    if (!program) throw new Error("Program not ready");
    if (!wallet.publicKey) throw new Error("Wallet not connected");

    const voterStatePda = await deriveVoterStatePda(pollPda);

    await program.methods
      .addVoter()
      .accounts({
        voter: wallet.publicKey,
        poll: pollPda,
        voterState: voterStatePda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return voterStatePda;
  }

  async function vote(pollPda: PublicKey, poll: PollAccount, voteYes: boolean) {
    if (!program) throw new Error("Program not ready");
    if (!wallet.publicKey) throw new Error("Wallet not connected");

    const voterStatePda = await deriveVoterStatePda(pollPda);

    const voterPassAta = await getAssociatedTokenAddress(
      poll.votingMint,
      wallet.publicKey
    );

    await program.methods
      .vote(voteYes)
      .accounts({
        voter: wallet.publicKey,
        poll: pollPda,
        voterState: voterStatePda,
        votingMint: poll.votingMint,
        voterPassTokenAccount: voterPassAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
  }

  return {
    program,
    wallet,
    loadPoll,
    addVoter,
    vote,
  };
}