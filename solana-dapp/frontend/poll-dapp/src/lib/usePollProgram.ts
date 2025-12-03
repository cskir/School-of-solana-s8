"use client";

import { useMemo } from "react";
import * as anchor from "@coral-xyz/anchor";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import idl from "../idl/anchor_project.json";
import { PROGRAM_ID, RPC_ENDPOINT } from "../config/solana";

export function usePollProgram() {
  const { connection: ctxConnection } = useConnection();
  const wallet = useWallet();

  const connection = useMemo(() => {
    return (
      ctxConnection ??
      new anchor.web3.Connection(RPC_ENDPOINT, "confirmed")
    );
  }, [ctxConnection]);

  const provider = useMemo(() => {
    if (!wallet.publicKey) return null;

    return new anchor.AnchorProvider(
      connection,
      wallet as unknown as anchor.Wallet,
      { commitment: "confirmed" }
    );
  }, [connection, wallet]);

  const program = useMemo(() => {
    if (!provider) return null; 
    return new anchor.Program(idl as anchor.Idl, provider);
  }, [provider]);

  return { program, wallet, provider, connection, PROGRAM_ID };
}