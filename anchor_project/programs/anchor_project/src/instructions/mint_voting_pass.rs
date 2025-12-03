use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, TokenAccount, Token, MintTo, mint_to};

use crate::errors::VotingError;
use crate::states::*;


pub fn mint_voting_pass(ctx:Context<MintVotingPass>) -> Result<()> {
    let poll = &ctx.accounts.poll;
    require!(poll.admin == ctx.accounts.admin.key(), VotingError::Unauthorized);
    
    let cpi_accounts = MintTo {
        mint: ctx.accounts.voting_mint.to_account_info(),
        to: ctx.accounts.voter_pass_token_account.to_account_info(),
        authority: ctx.accounts.admin.to_account_info(),
    };

    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(), 
        cpi_accounts);

    mint_to(cpi_ctx, 1)?;

    Ok(())
}

#[derive(Accounts)]
pub struct MintVotingPass<'info>{
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(mut)]
    pub poll: Account<'info, Poll>,

    #[account(mut)]
    pub voting_mint: Account<'info,  Mint>,

    #[account(mut, 
        constraint = voter_pass_token_account.mint == voting_mint.key() && 
            voter_pass_token_account.owner == voter.key(),
    )]
    pub voter_pass_token_account: Account<'info,  TokenAccount>,

    /// CHECK voter is not siggner
    pub voter: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
}