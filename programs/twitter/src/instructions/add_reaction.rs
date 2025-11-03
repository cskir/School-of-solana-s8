//-------------------------------------------------------------------------------
///
/// TASK: Implement the add reaction functionality for the Twitter program
/// 
/// Requirements:
/// - Initialize a new reaction account with proper PDA seeds
/// - Increment the appropriate counter (likes or dislikes) on the tweet
/// - Set reaction fields: type, author, parent tweet, and bump
/// - Handle both Like and Dislike reaction types
/// 
///-------------------------------------------------------------------------------

use anchor_lang::prelude::*;

use crate::errors::TwitterError;
use crate::states::*;

pub fn add_reaction(ctx: Context<AddReactionContext>, reaction: ReactionType) -> Result<()> {
    let tweet_reaction = &mut ctx.accounts.tweet_reaction;

    tweet_reaction.reaction_author = ctx.accounts.reaction_author.key();
    
    let parent_tweet = &mut ctx.accounts.tweet;

    tweet_reaction.parent_tweet = parent_tweet.key();
    tweet_reaction.bump = ctx.bumps.tweet_reaction;

    match reaction {
        ReactionType::Like => {
            require!(parent_tweet.likes < u64::MAX, TwitterError::MaxLikesReached);            
            parent_tweet.likes += 1;
        },
        ReactionType::Dislike => {
            require!(parent_tweet.dislikes < u64::MAX, TwitterError::MaxDislikesReached);
            parent_tweet.dislikes += 1;
        },        
    }

    tweet_reaction.reaction = reaction;

    Ok(())
}

#[derive(Accounts)]
pub struct AddReactionContext<'info> {
    #[account(mut)]
    pub reaction_author: Signer<'info>,
    #[account( 
        init,
        payer = reaction_author, 
        // space = discriminant + size
        space = 8 + Reaction::INIT_SPACE,
        seeds = [TWEET_REACTION_SEED.as_bytes(), reaction_author.key().as_ref(), tweet.key().as_ref()],
        bump,
    )]
    pub tweet_reaction: Account<'info, Reaction>,
    #[account(mut)]
    pub tweet: Account<'info, Tweet>,
    pub system_program: Program<'info, System>,
}
