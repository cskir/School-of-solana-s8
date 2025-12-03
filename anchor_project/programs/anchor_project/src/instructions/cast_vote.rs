use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

use crate::errors::VotingError;
use crate::states::*;

pub fn cast_vote(ctx: Context<CastVote>, vote_yes: bool) -> Result<()> {
    let poll = &mut ctx.accounts.poll;
    let voter = &ctx.accounts.voter;    
    let voter_state = &mut ctx.accounts.voter_state;
    let now = Clock::get()?.unix_timestamp;

    require!(poll.is_active, VotingError::NotActive);
    require!(now >= poll.start_ts && now <= poll.end_ts, VotingError::NotInTimeWindow);
    require!(!voter_state.has_voted, VotingError::AlreadyVoted);
    require!(voter_state.voter == voter.key(), VotingError::Unauthorized);
    require!(ctx.accounts.voter_pass_token_account.amount > 0, VotingError::NoPass);
    
    let cpi_accounts = token::Burn {
        mint: ctx.accounts.voting_mint.to_account_info(),
        from: ctx.accounts.voter_pass_token_account.to_account_info(),
        authority: voter.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(), 
        cpi_accounts);
    token::burn(cpi_ctx, 1)?;

    voter_state.has_voted = true;

    if vote_yes {
        poll.total_yes = poll.total_yes.checked_add(1).unwrap();
    } else {
        poll.total_no = poll.total_no.checked_add(1).unwrap();
    }
        
    Ok(())
}

#[derive(Accounts)]
pub struct CastVote<'info>{
    #[account(mut)]
    pub voter: Signer<'info>,
    
    #[account(mut)]
    pub poll: Account<'info, Poll>,

    #[account( 
        mut,         
        seeds = [b"voter_state", poll.key().as_ref(), voter.key().as_ref()],
        bump,        
    )]
    pub voter_state: Account<'info, VoterState>,
    
    #[account(mut)]
    pub voting_mint: Account<'info,  Mint>,

    #[account(mut, 
        constraint = voter_pass_token_account.mint == voting_mint.key() && 
            voter_pass_token_account.owner == voter.key(),
    )]
    pub voter_pass_token_account: Account<'info,  TokenAccount>,

    pub token_program: Program<'info, Token>,
}
