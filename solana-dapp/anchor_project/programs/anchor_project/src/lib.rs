#![allow(unexpected_cfgs)]

use crate::instructions::*;
use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod states;

declare_id!("5rmQS8GUu872Xofm9LD1D8CUDvwdrdR32XLDbxcBcWED");

#[program]
pub mod anchor_project {

    use super::*;

    pub fn initialize(
        ctx: Context<InitializePoll>, 
        poll_id: u64,
        question: String,
        start_ts: i64,
        end_ts: i64,)
    -> Result<()> {
        initialize_poll(ctx, poll_id, question, start_ts, end_ts)
    }

    pub fn start(
        ctx: Context<StartPoll>,)
    -> Result<()> {
        start_poll(ctx)
    }

    pub fn add_voter(
        ctx: Context<InitializeVoterState>,)
    -> Result<()> {
        initialize_voter_state(ctx)
    }

    pub fn mint_pass(
        ctx: Context<MintVotingPass>,)
    -> Result<()> {
        mint_voting_pass(ctx)
    }

    pub fn vote(
        ctx: Context<CastVote>, vote_yes: bool)
    -> Result<()> {
        cast_vote(ctx, vote_yes)
    }
}

