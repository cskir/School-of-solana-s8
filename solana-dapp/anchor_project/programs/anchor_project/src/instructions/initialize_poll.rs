use anchor_lang::prelude::*;
use anchor_spl::token::{Mint};

use crate::errors::VotingError;
use crate::states::*;

pub fn initialize_poll(
    ctx: Context<InitializePoll>,
    poll_id: u64,
    question: String,
    start_ts: i64,
    end_ts: i64,
) -> Result<()> {
    require!(question.len() <= QUESTION_LENGTH, VotingError::QuestionTooLong);    
    require!(start_ts < end_ts, VotingError::InvalidTime);        
    
    let poll = &mut ctx.accounts.poll;

    poll.admin = ctx.accounts.admin.key();
    poll.poll_id = poll_id;
    poll.question = question;
    poll.start_ts = start_ts;
    poll.end_ts = end_ts;
    poll.is_active = false;
    poll.voting_mint = ctx.accounts.voting_mint.key();
    poll.total_yes = 0;
    poll.total_no = 0;

    Ok(())
}
#[derive(Accounts)]
#[instruction(poll_id: u64)]
pub struct InitializePoll<'info> {
    #[account(mut)]    
    pub admin: Signer<'info>,

    #[account(
        init, 
        payer= admin,         
        space= 8 + Poll::INIT_SPACE,        
        // just b"poll" does not work....
        seeds= [b"pollpoll", &poll_id.to_le_bytes()],
        bump,
    )]
    pub poll: Account<'info, Poll>,

    pub voting_mint: Account<'info, Mint>,

    pub system_program: Program<'info, System>,
}
