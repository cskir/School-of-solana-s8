import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { AnchorProject } from "../target/types/anchor_project";
import { PublicKey, SystemProgram, Keypair} from "@solana/web3.js";
import { createMint, DefaultAccountStateLayout, getAccount, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import { expect, assert } from "chai";

//const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({units:1_000_000,})

describe("Poll", () => {   
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.anchorProject as Program<AnchorProject>;
  const wallet = provider.wallet as anchor.Wallet;
  const question = "Do you like to catch bugs?";
  let votingMint :PublicKey;
  let pollPDA: PublicKey;
  let start :number;
  let end: number;
  let pollId: number;
  const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

  before(async () => {
    votingMint = await createMint(
      provider.connection,
      wallet.payer,          // payer (admin keypair)
      wallet.publicKey,      // mint authority
      null,                  // freeze authority
      0                      // decimals
    );

    pollId = 1;
    [pollPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("pollpoll"),
        new BN(pollId).toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    start = Math.floor(Date.now() / 1000) - 60;
    end = start + 3600;

    await program.methods
      .initialize(
        new BN(pollId),question,new BN(start),new BN(end),)
      .accounts({
        admin: wallet.publicKey,
        votingMint,
        poll: pollPDA,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  })

  describe("Initialize Poll", () => {      
    it("Should successfully create pass mint", async () => {
      expect(votingMint).to.be.instanceOf(PublicKey);
    });

    it ("Should successfully initialize poll", async () => {
      const poll = await program.account.poll.fetch(pollPDA);

      expect(poll.admin.toBase58()).to.equal(wallet.publicKey.toBase58());
      expect(poll.votingMint.toBase58()).to.equal(votingMint.toBase58());
      expect(Number(poll.pollId)).to.equal(pollId);
      expect(poll.question).to.equal(question);
      expect(Number(poll.startTs)).to.equal(start);
      expect(Number(poll.endTs)).to.equal(end);
      expect(poll.isActive).to.equal(false);
      expect(Number(poll.totalYes)).to.equal(0);
      expect(Number(poll.totalNo)).to.equal(0);
    });

    it ("Should fail create poll for the same poll id", async () => {    
      const start = Math.floor(Date.now() /1000) + 60;
      const end = start + 3600;

      try {
        await program.methods
        .initialize(
          new BN(pollId), question, new BN(start), new BN(end))
        .accounts({
          admin: wallet.publicKey, 
          votingMint, 
          poll: pollPDA, 
          systemProgram: SystemProgram.programId})
        .rpc();

        expect.fail("Poll initialization should have failed for duplicate poll Id"); 
      } catch (error) {
        const msg = error.error?.errorMessage || error.toString();
        expect(msg).to.match(/already in use|exists|in use/); 
        }
    });

    it ("Should fail create poll for long question", async () => {          
      const [pda] = PublicKey.findProgramAddressSync([
          Buffer.from("pollpoll"), 
          new BN(pollId + 1).toArrayLike(Buffer, "le", 8),
        ], 
        program.programId);         
      
      const start = Math.floor(Date.now() /1000) + 60;
      const end = start + 3600;
      const ten = "ten bytes!"        
      const question = ten.repeat(20) + "+";
      
      try {
        await program.methods
        .initialize(
          new BN(pollId+1), question, new BN(start), new BN(end))
        .accounts({
          admin: wallet.publicKey, 
          votingMint, 
          poll: pda, 
          systemProgram: SystemProgram.programId})
        .rpc();

        expect.fail("Poll initialization should have failed for long question"); 
      } catch (error) {
        //console.log("logs:\n", error.logs?.join("\n"));
        const err = anchor.AnchorError.parse(error.logs);
        expect(err.error.errorCode.code).to.match(/QuestionTooLong/);                 
      }
    });

    it ("Should fail Initialize poll when end is not later than start", async () => {
      try {
        
        const [pda] = PublicKey.findProgramAddressSync([
          Buffer.from("pollpoll"), 
          new BN(pollId + 1).toArrayLike(Buffer, "le", 8),
        ], 
        program.programId);         
    
        const start = Math.floor(Date.now() /1000) + 60;
        const end = start;
        
        await program.methods
        .initialize(
          new BN(pollId + 1), question, new BN(start), new BN(end))
        .accounts({
          admin: wallet.publicKey, 
          votingMint, 
          poll: pda, 
          systemProgram: SystemProgram.programId})
        .rpc();

        expect.fail("Poll initialization should have failed with end is not later than start"); 
      } catch (error) {
        const msg = error.error?.errorMessage || error.toString();
        expect(msg).to.match(/Invalid start-end time setting/); 
        }
    });
  })

  describe("Start Poll", () => {      
    it ("Should successfully start the poll", async () => {      
      await program.methods
        .start()
        .accounts({
          admin: wallet.publicKey, 
          poll: pollPDA,
        })  
        .rpc();
      
      const poll = await program.account.poll.fetch(pollPDA);
      expect(poll.isActive).to.equal(true);
    });

    it ("Should fail re-start the poll", async () => {      
       try {
        await program.methods
          .start()
          .accounts({
            admin: wallet.publicKey, 
            poll: pollPDA,})          
          .rpc();

        expect.fail("Re-Start the poll should fail"); 
      } catch (error) {
        const msg = error.error?.errorMessage || error.toString();
        expect(msg).to.match(/Voting is already active/); 
      }  
    });

    it ("Should fail if not the admin try to start the poll", async () => {    
      const randomUser = Keypair.generate();
      const tmpPollId = 99;
      const [tmpPollDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("pollpoll"),
        new BN(tmpPollId).toArrayLike(Buffer, "le", 8),
      ],
      program.programId
      );

      await program.methods
        .initialize(
          new BN(tmpPollId), question, new BN(start),new BN(end),)
        .accounts({
          admin: wallet.publicKey,
          votingMint,
          poll: tmpPollDA,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      try {
        await program.methods
          .start()
          .accounts({
            admin: randomUser.publicKey, 
            poll: tmpPollDA,})
          .signers([randomUser])  
          .rpc();

        expect.fail("Start the poll by not the admin should have failed"); 
      } catch (error) {
        const msg = error.error?.errorMessage || error.toString();
        expect(msg).to.match(/Unauthorized/); 
      }
    }); 

    it ("Should fail at start in case of out of time window", async () => {    
      const tmpPollId = 999;
      const [tmpPollDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("pollpoll"),
        new BN(tmpPollId).toArrayLike(Buffer, "le", 8),
      ],
      program.programId
      );

      const start = Math.floor(Date.now() / 1000) - 3600;
      const end = start + 60;

      await program.methods
        .initialize(
          new BN(tmpPollId), question, new BN(start), new BN(end),)
        .accounts({
          admin: wallet.publicKey,
          votingMint,
          poll: tmpPollDA,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      try {
        await program.methods
          .start()
          .accounts({
            admin: wallet.publicKey, 
            poll: tmpPollDA,})          
          .rpc();

        expect.fail("Start the poll out of time window"); 
      } catch (error) {
        const msg = error.error?.errorMessage || error.toString();
        expect(msg).to.match(/Out of time window/); 
      }
    });
  })

  describe("Initialize Voter state", () => {

    it ("Should successfully create voter state", async () => {
      const voter = Keypair.generate();
      await airdrop(provider.connection, voter.publicKey);
      
      const [voterStatePDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("voter_state"),
          pollPDA.toBuffer(),
          voter.publicKey.toBuffer()
        ], 
        program.programId
      );

      await program.methods
        .addVoter()
        .accounts({
          voter: voter.publicKey,
          poll: pollPDA,
          voterState: voterStatePDA,
          systemProgram: SystemProgram.programId,       
        })
        .signers([voter]) 
        .rpc();
      
      const voter_state = await program.account.voterState.fetch(voterStatePDA);
      
      expect(voter_state.voter.toBase58()).to.equal(voter.publicKey.toBase58());
      expect(voter_state.poll.toBase58()).to.equal(pollPDA.toBase58());
      expect(voter_state.hasVoted).to.equal(false);
    });

    it ("Should fail for duplicate vote state", async () => {    
      const voter = Keypair.generate();
      await airdrop(provider.connection, voter.publicKey);
      
      const [voterStatePDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("voter_state"),
          pollPDA.toBuffer(),
          voter.publicKey.toBuffer()
        ], 
        program.programId
      );

      await program.methods
        .addVoter()
        .accounts({
          voter: voter.publicKey,
          poll: pollPDA,
          voterState: voterStatePDA,
          systemProgram: SystemProgram.programId,       
        })
        .signers([voter]) 
        .rpc();

      try {
        await program.methods
        .addVoter()
        .accounts({
          voter: voter.publicKey,
          poll: pollPDA,
          voterState: voterStatePDA,
          systemProgram: SystemProgram.programId,       
        })
        .signers([voter]) 
        .rpc();
      

        expect.fail("Second Voter state initialization should have failed"); 
      } catch (error) {
        const msg = error.error?.errorMessage || error.toString();
        expect(msg).to.match(/already in use|initialized|exists|in use/); 
      }
    });
    }
  )
  describe("Vote", () => {
    it ("Should successfully vote yes with Pass", async () => {          
      const voter = Keypair.generate();
      await airdrop(provider.connection, voter.publicKey);
      const [voterStatePDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("voter_state"),
          pollPDA.toBuffer(),
          voter.publicKey.toBuffer()
        ], 
        program.programId
      );

      await program.methods
        .addVoter()
        .accounts({
          voter: voter.publicKey,
          poll: pollPDA,
          voterState: voterStatePDA,
          systemProgram: SystemProgram.programId,       
        })
        .signers([voter]) 
        .rpc();
      
      const voterATA = await getOrCreateAssociatedTokenAccount(
        provider.connection, 
        wallet.payer,
        votingMint, 
        voter.publicKey
      );

      const voterPassTokenAccount = voterATA.address;

      await program.methods
        .mintPass()
        .accounts({
          admin: wallet.publicKey, 
          poll:pollPDA,
          votingMint, 
          voterPassTokenAccount,
          voter: voter.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      const tokenAccountBefore = await getAccount(
        provider.connection, voterPassTokenAccount);         
      
      expect(Number(tokenAccountBefore.amount)).to.equal(1);
      
      const pollBefore = await program.account.poll.fetch(pollPDA);
      const totalYesBefore = Number(pollBefore.totalYes);
      const totalNoBefore = Number(pollBefore.totalNo);

      await program.methods
      .vote(true)
      .accounts({
        voter:voter.publicKey, 
        poll:pollPDA, 
        voterState: voterStatePDA, 
        voterPassTokenAccount, 
        votingMint, 
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([voter])
      .rpc();
      
      const tokenAccountAfter = await getAccount(
        provider.connection, voterPassTokenAccount);         
      
      expect(Number(tokenAccountAfter.amount)).to.equal(0);
      
      const voterState = await program.account.voterState.fetch(voterStatePDA);
      expect(voterState.hasVoted).to.equal(true); 

      const pollAfter = await program.account.poll.fetch(pollPDA);
      expect(Number(pollAfter.totalYes)- totalYesBefore).to.equal(1);
      expect(Number(pollAfter.totalNo)- totalNoBefore).to.equal(0);
    });

    it ("Should fail for second vote", async () => {          
      const voter = Keypair.generate();
      await airdrop(provider.connection, voter.publicKey);
      const [voterStatePDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("voter_state"),
          pollPDA.toBuffer(),
          voter.publicKey.toBuffer()
        ], 
        program.programId
      );

      await program.methods
        .addVoter()
        .accounts({
          voter: voter.publicKey,
          poll: pollPDA,
          voterState: voterStatePDA,
          systemProgram: SystemProgram.programId,       
        })
        .signers([voter]) 
        .rpc();
      
      const voterATA = await getOrCreateAssociatedTokenAccount(
        provider.connection, 
        wallet.payer,
        votingMint, 
        voter.publicKey
      );

      const voterPassTokenAccount = voterATA.address;

      await program.methods
        .mintPass()
        .accounts({
          admin: wallet.publicKey, 
          poll:pollPDA,
          votingMint, 
          voterPassTokenAccount,
          voter: voter.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      const tokenAccountBefore = await getAccount(
        provider.connection, voterPassTokenAccount);         
      
      expect(Number(tokenAccountBefore.amount)).to.equal(1);
      
      const pollBefore = await program.account.poll.fetch(pollPDA);
      const totalYesBefore = Number(pollBefore.totalYes);
      const totalNoBefore = Number(pollBefore.totalNo);

      await program.methods
      .vote(false)
      .accounts({
        voter:voter.publicKey, 
        poll:pollPDA, 
        voterState: voterStatePDA, 
        voterPassTokenAccount, 
        votingMint, 
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([voter])
      .rpc();

      const tokenAccountAfter = await getAccount(
        provider.connection, voterPassTokenAccount);         
      
      expect(Number(tokenAccountAfter.amount)).to.equal(0);
      
      const voterState = await program.account.voterState.fetch(voterStatePDA);
      expect(voterState.hasVoted).to.equal(true); 

      const pollAfter = await program.account.poll.fetch(pollPDA);
      expect(Number(pollAfter.totalYes)- totalYesBefore).to.equal(0);
      expect(Number(pollAfter.totalNo)- totalNoBefore).to.equal(1);
      
      try{await program.methods
      .vote(true)
      .accounts({
        voter:voter.publicKey, 
        poll:pollPDA, 
        voterState: voterStatePDA, 
        voterPassTokenAccount, 
        votingMint, 
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([voter])
      .rpc();
      expect.fail("Second vote should have failed"); 
    } catch (error) {
      const msg = error.error?.errorMessage || error.toString();
      expect(msg).to.match(/Voter already voted/); 
    }          
    });

    it ("Should fail for inactive poll", async () => {                
      const tmpPollId = 9999;
      const [tmpPollPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("pollpoll"),
        new BN(tmpPollId).toArrayLike(Buffer, "le", 8),
      ],
      program.programId
      );

      await program.methods
        .initialize(
          new BN(tmpPollId), question, new BN(start), new BN(end),)
        .accounts({
          admin: wallet.publicKey,
          votingMint,
          poll: tmpPollPDA,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      
      const voter = Keypair.generate();
      await airdrop(provider.connection, voter.publicKey);
      const [voterStatePDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("voter_state"),
          tmpPollPDA.toBuffer(),
          voter.publicKey.toBuffer()
        ], 
        program.programId
      );

      await program.methods
        .addVoter()
        .accounts({
          voter: voter.publicKey,
          poll: tmpPollPDA,
          voterState: voterStatePDA,
          systemProgram: SystemProgram.programId,       
        })
        .signers([voter]) 
        .rpc();
      
      const voterATA = await getOrCreateAssociatedTokenAccount(
        provider.connection, 
        wallet.payer,
        votingMint, 
        voter.publicKey
      );

      const voterPassTokenAccount = voterATA.address;

      await program.methods
        .mintPass()
        .accounts({
          admin: wallet.publicKey, 
          poll:tmpPollPDA,
          votingMint, 
          voterPassTokenAccount,
          voter: voter.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      try{await program.methods
      .vote(true)
      .accounts({
        voter:voter.publicKey, 
        poll:tmpPollPDA, 
        voterState: voterStatePDA, 
        voterPassTokenAccount, 
        votingMint, 
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([voter])
      .rpc();
      expect.fail("Not active vote should have failed"); 
    } catch (error) {
      const msg = error.error?.errorMessage || error.toString();
      expect(msg).to.match(/Voting is not active/); 
    }          
    });

     it ("Should fail for out of time window poll", async () => {                
      const tmpPollId = 99999;
      const [tmpPollPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("pollpoll"),
        new BN(tmpPollId).toArrayLike(Buffer, "le", 8),
      ],
      program.programId
      );

      const start = Math.floor(Date.now() / 1000) - 60;
      const end = start + 63;
      
      await program.methods
        .initialize(
          new BN(tmpPollId), question, new BN(start), new BN(end),)
        .accounts({
          admin: wallet.publicKey,
          votingMint,
          poll: tmpPollPDA,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

        await program.methods
        .start()
        .accounts({
          admin: wallet.publicKey, 
          poll: tmpPollPDA,
        })  
        .rpc();
      
      const voter = Keypair.generate();
      await airdrop(provider.connection, voter.publicKey);
      const [voterStatePDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("voter_state"),
          tmpPollPDA.toBuffer(),
          voter.publicKey.toBuffer()
        ], 
        program.programId
      );

      await program.methods
        .addVoter()
        .accounts({
          voter: voter.publicKey,
          poll: tmpPollPDA,
          voterState: voterStatePDA,
          systemProgram: SystemProgram.programId,       
        })
        .signers([voter]) 
        .rpc();
      
      const voterATA = await getOrCreateAssociatedTokenAccount(
        provider.connection, 
        wallet.payer,
        votingMint, 
        voter.publicKey
      );

      const voterPassTokenAccount = voterATA.address;

      await program.methods
        .mintPass()
        .accounts({
          admin: wallet.publicKey, 
          poll:tmpPollPDA,
          votingMint, 
          voterPassTokenAccount,
          voter: voter.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      try{await program.methods
      .vote(true)
      .accounts({
        voter:voter.publicKey, 
        poll:tmpPollPDA, 
        voterState: voterStatePDA, 
        voterPassTokenAccount, 
        votingMint, 
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([voter])
      .rpc();
      expect.fail("Out of time window vote should have failed"); 
    } catch (error) {
      const msg = error.error?.errorMessage || error.toString();
      expect(msg).to.match(/Out of time window/); 
    }          
    });

    it ("Should fail vote token with other signer", async () => {          
      const voter = Keypair.generate();
      await airdrop(provider.connection, voter.publicKey);
      const [voterStatePDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("voter_state"),
          pollPDA.toBuffer(),
          voter.publicKey.toBuffer()
        ], 
        program.programId
      );
      await program.methods
        .addVoter()
        .accounts({
          voter: voter.publicKey,
          poll: pollPDA,
          voterState: voterStatePDA,
          systemProgram: SystemProgram.programId,       
        })
        .signers([voter]) 
        .rpc();
      
      const voterATA = await getOrCreateAssociatedTokenAccount(
        provider.connection, 
        wallet.payer,
        votingMint, 
        voter.publicKey
      );

      const voterPassTokenAccount = voterATA.address;

      await program.methods
        .mintPass()
        .accounts({
          admin: wallet.publicKey, 
          poll:pollPDA,
          votingMint, 
          voterPassTokenAccount,
          voter: voter.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
     
      const randomUser = Keypair.generate();      
      await airdrop(provider.connection, randomUser.publicKey);

      try{await program.methods
      .vote(true)
      .accounts({
        voter:voter.publicKey, 
        poll:pollPDA, 
        voterState: voterStatePDA, 
        voterPassTokenAccount, 
        votingMint, 
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([randomUser])
      .rpc();
      expect.fail("Vote with other user should have failed"); 
    } catch (error) {
      const msg = error.error?.errorMessage || error.toString();
      expect(msg).to.match(/unknown signer/); 
    }          
    });

    it ("Should fail vote with other's pass token", async () => {          
      const voter = Keypair.generate();
      await airdrop(provider.connection, voter.publicKey);
      const [voterStatePDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("voter_state"),
          pollPDA.toBuffer(),
          voter.publicKey.toBuffer()
        ], 
        program.programId
      );
      await program.methods
        .addVoter()
        .accounts({
          voter: voter.publicKey,
          poll: pollPDA,
          voterState: voterStatePDA,
          systemProgram: SystemProgram.programId,       
        })
        .signers([voter]) 
        .rpc();

      const voterATA = await getOrCreateAssociatedTokenAccount(
        provider.connection, 
        wallet.payer,
        votingMint, 
        voter.publicKey
      )
      const voterPassTokenAccount = voterATA.address;

      await program.methods
        .mintPass()
        .accounts({
          admin: wallet.publicKey, 
          poll:pollPDA,
          votingMint, 
          voterPassTokenAccount,
          voter: voter.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      const otherVoter = Keypair.generate();      
      await airdrop(provider.connection, otherVoter.publicKey);

      const otherVoterATA = await getOrCreateAssociatedTokenAccount(
        provider.connection, 
        wallet.payer,
        votingMint, 
        otherVoter.publicKey
      )
      const otherVoterPassTokenAccount = otherVoterATA.address;

      try{await program.methods
      .vote(true)
      .accounts({
        voter:voter.publicKey, 
        poll:pollPDA, 
        voterState: voterStatePDA, 
        voterPassTokenAccount: otherVoterPassTokenAccount, 
        votingMint, 
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([voter])
      .rpc();
      expect.fail("Vote with other user should have failed"); 
    } catch (error) {
      const msg = error.error?.errorMessage || error.toString();
      expect(msg).to.match(/constraint/); 
    }          
    });
    it ("Should fail vote with other's voter state", async () => {          
      const voter = Keypair.generate();
      await airdrop(provider.connection, voter.publicKey);
      const [voterStatePDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("voter_state"),
          pollPDA.toBuffer(),
          voter.publicKey.toBuffer()
        ], 
        program.programId
      );
      await program.methods
        .addVoter()
        .accounts({
          voter: voter.publicKey,
          poll: pollPDA,
          voterState: voterStatePDA,
          systemProgram: SystemProgram.programId,       
        })
        .signers([voter]) 
        .rpc();

      const voterATA = await getOrCreateAssociatedTokenAccount(
        provider.connection, 
        wallet.payer,
        votingMint, 
        voter.publicKey
      )
      const voterPassTokenAccount = voterATA.address;

      await program.methods
        .mintPass()
        .accounts({
          admin: wallet.publicKey, 
          poll:pollPDA,
          votingMint, 
          voterPassTokenAccount,
          voter: voter.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      const otherVoter = Keypair.generate();      
      await airdrop(provider.connection, otherVoter.publicKey);
      const [otherVoterStatePDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("voter_state"),
          pollPDA.toBuffer(),
          otherVoter.publicKey.toBuffer()
        ], 
        program.programId
      );
      await program.methods
        .addVoter()
        .accounts({
          voter: otherVoter.publicKey,
          poll: pollPDA,
          voterState: otherVoterStatePDA,
          systemProgram: SystemProgram.programId,       
        })
        .signers([otherVoter]) 
        .rpc();

      try{await program.methods
      .vote(true)
      .accounts({
        voter:voter.publicKey, 
        poll:pollPDA, 
        voterState: otherVoterStatePDA, 
        voterPassTokenAccount: voterPassTokenAccount, 
        votingMint, 
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([voter])
      .rpc();
      expect.fail("Vote with other voter's state should have failed"); 
    } catch (error) {
      const msg = error.error?.errorMessage || error.toString();
      expect(msg).to.match(/seeds constraint was violated/); 
    }          
    });
  })
})


function delay(ms:number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function airdrop(connection: any, address: any, amount = 1000000000) {
  await connection.confirmTransaction(await connection.requestAirdrop(address, amount), "confirmed");
}