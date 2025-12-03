use anchor_lang::prelude::*;

pub const QUESTION_LENGTH: usize = 200;

#[account]
#[derive(InitSpace)]
pub struct Poll {
    pub admin: Pubkey,
    pub poll_id: u64,
    #[max_len(QUESTION_LENGTH)]
    pub question: String, 
    pub start_ts: i64,
    pub end_ts: i64,
    pub is_active: bool,
    pub voting_mint: Pubkey,
    pub total_yes: u64,
    pub total_no: u64,
}

#[account]
#[derive(InitSpace)]
pub struct VoterState {
    pub poll: Pubkey,
    pub voter: Pubkey,    
    pub has_voted: bool,
}