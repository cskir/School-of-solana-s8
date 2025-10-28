//-------------------------------------------------------------------------------
///
/// TASK: Implement the deposit functionality for the on-chain vault
/// 
/// Requirements:
/// - Verify that the user has enough balance to deposit
/// - Verify that the vault is not locked
/// - Transfer lamports from user to vault using CPI (Cross-Program Invocation)
/// - Emit a deposit event after successful transfer
/// 
///-------------------------------------------------------------------------------

use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke;
use anchor_lang::solana_program::system_instruction;
use crate::state::Vault;
use crate::errors::VaultError;
use crate::events::DepositEvent;

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account( mut)]
    pub vault: Account<'info, Vault>,
    pub system_program: Program<'info, System>,
}

pub fn _deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {    
    let user = &ctx.accounts.user;
    let user_lamport = user.to_account_info().lamports();
    
    require!(user_lamport >= amount, VaultError::InsufficientBalance);
    
    let vault = &mut ctx.accounts.vault;

    require!(!vault.locked, VaultError::VaultLocked);
 
    let vault_lamports = vault.to_account_info().lamports();
    vault_lamports
        .checked_add(amount)
        .ok_or(VaultError::Overflow)?;

    let ix = system_instruction::transfer(
        &user.to_account_info().key(), 
        &vault.to_account_info().key(), 
        amount);
    
    invoke(&ix, 
    &[
        user.to_account_info().clone(), 
        vault.to_account_info().clone(),
        ctx.accounts.system_program.to_account_info().clone() 
    ])?;

    emit!(DepositEvent {
        amount: amount, 
        user: user.key(),
        vault: vault.key(),
    });

    Ok(())
}