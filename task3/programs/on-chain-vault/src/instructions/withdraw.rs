//-------------------------------------------------------------------------------
///
/// TASK: Implement the withdraw functionality for the on-chain vault
/// 
/// Requirements:
/// - Verify that the vault is not locked
/// - Verify that the vault has enough balance to withdraw
/// - Transfer lamports from vault to vault authority
/// - Emit a withdraw event after successful transfer
/// 
///-------------------------------------------------------------------------------

use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_lang::solana_program::system_instruction;
use crate::state::Vault;
use crate::errors::VaultError;
use crate::events::WithdrawEvent;

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub vault_authority: Signer<'info>,
    #[account( mut, 
        has_one = vault_authority, 
        seeds = [b"vault", vault_authority.key().as_ref()],
        bump)]
    pub vault: Account<'info, Vault>,
    pub system_program: Program<'info, System>,
}

pub fn _withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    
    require!(!vault.locked, VaultError::VaultLocked);

    let vault_account_info = vault.to_account_info();

    let rent_min = Rent::get()?.minimum_balance(vault_account_info.data_len());
    let vault_lamport = vault_account_info.lamports();
    let total_available = vault_lamport.saturating_sub(rent_min);
    
    require!(total_available >= amount, VaultError::InsufficientBalance);
    let vault_authority = &ctx.accounts.vault_authority;
    
    **vault_account_info.try_borrow_mut_lamports()? -= amount;
    **vault_authority.to_account_info().try_borrow_mut_lamports()? += amount;

    emit!(WithdrawEvent {
        amount: amount, 
        vault_authority: vault.vault_authority,
        vault: vault.key(),
    });

    Ok(())
}