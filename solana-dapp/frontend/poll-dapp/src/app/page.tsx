"use client";

import { useEffect, useMemo, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { usePollClient, PollAccount } from "../lib/pollClient";
import { PROGRAM_ID } from "../config/solana";

type VoterStateAccount = {
  poll: PublicKey;
  voter: PublicKey;
  hasVoted: boolean;
};

export default function Page() {
  const pollId = 1; 
  const { program, wallet, loadPoll, addVoter, vote } = usePollClient(pollId);

  const [pollPda, setPollPda] = useState<PublicKey | null>(null);
  const [poll, setPoll] = useState<PollAccount | null>(null);
  const [voterState, setVoterState] = useState<VoterStateAccount | null>(null);

  const [loadingPoll, setLoadingPoll] = useState(false);
  const [loadingVoterState, setLoadingVoterState] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [votingSide, setVotingSide] = useState<"yes" | "no" | null>(null);

  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

 async function loadVoterState(pollPda: PublicKey) {
    if (!program || !wallet.publicKey) {
      setVoterState(null);
      return;
    }

    setLoadingVoterState(true);
    setErrorMsg(null);

    try {
      const [voterStatePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("voter_state"),
          pollPda.toBuffer(),
          wallet.publicKey.toBuffer(),
        ],
        PROGRAM_ID
      );

      const vs = await (program as any).account.voterState.fetch(voterStatePda);
      setVoterState(vs as VoterStateAccount);
    } catch {
      // if there is no VoterState, can be fine
      setVoterState(null);
    } finally {
      setLoadingVoterState(false);
    }
  }

  async function handleLoadPoll() {
    if (!program) return;
    setLoadingPoll(true);
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      const { pollPda: pda, poll } = await loadPoll();
      setPollPda(pda);
      setPoll(poll);
      setInfoMsg("Poll state loaded from devnet.");

      if (wallet.publicKey) {
        await loadVoterState(pda);
      }
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message ?? e.toString());
      setPoll(null);
      setPollPda(null);
      setVoterState(null);
    } finally {
      setLoadingPoll(false);
    }
  }

  // on Wallet change -> refresh 
  useEffect(() => {
    if (pollPda && wallet.publicKey && program) {
      loadVoterState(pollPda);
    } else {
      setVoterState(null);
    }
  }, [wallet.publicKey, program]);

  async function handleRegisterAsVoter() {
    if (!program || !pollPda) return;
    if (!wallet.publicKey) {
      setErrorMsg("Connect with wallet first.");
      return;
    }

    setRegistering(true);
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      await addVoter(pollPda);
      await loadVoterState(pollPda);
      setInfoMsg("Vote registration is succesfull.");
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message ?? e.toString());
    } finally {
      setRegistering(false);
    }
  }

  async function handleVote(voteYes: boolean) {
    if (!program || !pollPda || !poll) return;
    if (!wallet.publicKey) {
      setErrorMsg("Connect with wallet first.");
      return;
    }

    setVotingSide(voteYes ? "yes" : "no");
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      await vote(pollPda, poll, voteYes);
      setInfoMsg(`Submitted vote: ${voteYes ? "YES" : "NO"}.`);      
      await handleLoadPoll();
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message ?? e.toString());
    } finally {
      setVotingSide(null);
    }
  }

  const hasVoterState = !!voterState;
  const alreadyVoted = !!voterState?.hasVoted;

  const canVote = useMemo(() => {
    if (!wallet.publicKey || !poll) return false;
    if (!poll.isActive) return false;

    const nowSec = Math.floor(Date.now() / 1000);
    const start = Number(poll.startTs);
    const end = Number(poll.endTs);
    if (nowSec < start || nowSec > end) return false;

    if (!hasVoterState) return false;
    if (alreadyVoted) return false;

    return true;
  }, [wallet.publicKey, poll, hasVoterState, alreadyVoted]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-start py-10 gap-8">
      <h1 className="text-3xl font-bold">Poll dApp – Devnet</h1>

      <WalletMultiButton />

      {/* State */}
      <div className="border rounded-xl px-4 py-3 text-sm space-y-1 w-full max-w-xl">
        <div className="flex justify-between gap-4">
          <span className="font-semibold">Wallet connected:</span>
          <span className="font-mono">
            {wallet.publicKey ? "yes" : "no"}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="font-semibold">Program loaded:</span>
          <span className="font-mono">
            {program ? "yes" : "no"}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="font-semibold">VoterState:</span>
          <span className="font-mono">
            {loadingVoterState
              ? "loading..."
              : hasVoterState
              ? alreadyVoted
                ? "registered + voted"
                : "registered"
              : "not registered"}
          </span>
        </div>
        {pollPda && (
          <div className="flex flex-col mt-2 text-xs break-all">
            <span className="font-semibold">Poll PDA:</span>
            <span>{pollPda.toBase58()}</span>
          </div>
        )}
      </div>

      {/* Poll state + actions */}
      <div className="border rounded-xl px-4 py-4 text-sm space-y-4 w-full max-w-xl">
        <button
          onClick={handleLoadPoll}
          disabled={!program || loadingPoll}
          className="w-full rounded-md bg-indigo-600 text-white py-2 text-sm disabled:opacity-50"
        >
          {loadingPoll ? "Loading poll..." : "Load poll state"}
        </button>

        {poll && (
          <div className="space-y-2">
            <div>
              <span className="font-semibold">Question:</span>{" "}
              <span>{poll.question}</span>
            </div>
            <div className="flex justify-between">
              <span>Yes votes:</span>
              <span className="font-mono">{Number(poll.totalYes)}</span>
            </div>
            <div className="flex justify-between">
              <span>No votes:</span>
              <span className="font-mono">{Number(poll.totalNo)}</span>
            </div>
            <div className="flex justify-between">
              <span>Active:</span>
              <span className="font-mono">
                {poll.isActive ? "true" : "false"}
              </span>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>Start:</span>
              <span>
                {new Date(Number(poll.startTs) * 1000).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>End:</span>
              <span>
                {new Date(Number(poll.endTs) * 1000).toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {/* Voter actions */}
        <div className="flex flex-col gap-2 pt-2 border-t mt-2">
          <button
            onClick={handleRegisterAsVoter}
            disabled={
              !program ||
              !pollPda ||
              !wallet.publicKey ||
              hasVoterState ||
              registering
            }
            className="w-full rounded-md bg-slate-700 text-white py-2 text-sm disabled:opacity-50"
          >
            {registering
              ? "Registering..."
              : hasVoterState
              ? "Already registered"
              : "Register as voter"}
          </button>

          <div className="flex gap-2">
            <button
              onClick={() => handleVote(true)}
              disabled={!canVote || votingSide !== null}
              className="flex-1 rounded-md bg-emerald-600 text-white py-2 text-sm disabled:opacity-50"
            >
              {votingSide === "yes" ? "Voting YES..." : "Vote YES"}
            </button>
            <button
              onClick={() => handleVote(false)}
              disabled={!canVote || votingSide !== null}
              className="flex-1 rounded-md bg-rose-600 text-white py-2 text-sm disabled:opacity-50"
            >
              {votingSide === "no" ? "Voting NO..." : "Vote NO"}
            </button>
          </div>

          {!poll && (
            <p className="text-xs text-gray-500">
              First load the poll state.
            </p>
          )}

          {!canVote && poll && (
            <p className="text-xs text-gray-500">
              You cannot vote: check that you are registered as a voter, 
              that the poll is active, that you are within the time window, 
              and that you have not voted yet.
            </p>
          )}
        </div>

        {infoMsg && (
          <p className="mt-2 text-xs text-emerald-600 whitespace-pre-line">
            {infoMsg}
          </p>
        )}

        {errorMsg && (
          <p className="mt-2 text-xs text-red-600 whitespace-pre-line">
            {errorMsg}
          </p>
        )}
      </div>
    </main>
  );
}
