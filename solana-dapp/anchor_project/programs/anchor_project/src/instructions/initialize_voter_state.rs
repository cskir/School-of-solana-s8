use anchor_lang::prelude::*;

use crate::states::*;

pub fn initialize_voter_state(ctx: Context<InitializeVoterState>) -> Result<()> {
    let voter_state = &mut ctx.accounts.voter_state;
    voter_state.poll = ctx.accounts.poll.key();
    voter_state.voter = ctx.accounts.voter.key();
    voter_state.has_voted = false;
    
    Ok(())
}

#[derive(Accounts)]
pub struct InitializeVoterState<'info>{
    #[account(mut)]
    pub voter: Signer<'info>,
    
    #[account(mut)]
    pub poll: Account<'info, Poll>,

    #[account( 
        init, 
        payer = voter,
        space = 8 + VoterState::INIT_SPACE,
        seeds= [b"voter_state", poll.key().as_ref(), voter.key().as_ref()],
        bump,        
    )]
    pub voter_state: Account<'info, VoterState>,
    
    pub system_program: Program<'info, System>,
}
