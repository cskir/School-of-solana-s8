use anchor_lang::prelude::*;

#[error_code]
pub enum VotingError {    
    #[msg("Invalid start-end time settings")]
    InvalidTime,
    #[msg("Out of time window")]
    NotInTimeWindow,
    #[msg("Voting is not active")]
    NotActive,
    #[msg("Voting is already active")]
    AlreadyActive,
    #[msg("Unauthorized")]
    Unauthorized,    
    #[msg("Missing voting Pass")]
    NoPass,
    #[msg("Voter already voted")]
    AlreadyVoted,
    #[msg("Question too long")]
    QuestionTooLong,
}
