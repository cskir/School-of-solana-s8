use anchor_lang::prelude::*;

use crate::errors::VotingError;
use crate::states::*;

pub fn start_poll(ctx:Context<StartPoll>) -> Result<()> {
    let poll = &mut ctx.accounts.poll;
    let now = Clock::get()?.unix_timestamp;

    require!(ctx.accounts.admin.key() == poll.admin, VotingError::Unauthorized);
    require!(now >= poll.start_ts && now < poll.end_ts, VotingError::NotInTimeWindow);
    require!(!poll.is_active, VotingError::AlreadyActive);

    poll.is_active = true;
    Ok(())
}

#[derive(Accounts)]
pub struct StartPoll<'info>{
    #[account(mut)]
    pub admin: Signer<'info>,
  
    #[account(mut)]
    pub poll: Account<'info, Poll>,
}
