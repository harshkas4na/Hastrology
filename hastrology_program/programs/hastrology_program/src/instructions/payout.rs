use anchor_lang::{
    prelude::*,
    system_program::{transfer, Transfer},
};

use crate::{
    constants::{LOTTERY_STATE_SEED, POT_VAULT_SEED, USER_TICKET_SEED}, errors::HashtrologyErrors, 
    state::{LotteryState, UserTicket}
};

#[derive(Accounts)]
pub struct Payout<'info> {
    #[account(
        mut,
        constraint = authority.key() == lottery_state.authority @ HashtrologyErrors::UnauthorizedAuthority
    )]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [LOTTERY_STATE_SEED],
        bump = lottery_state.lottery_state_bump
    )]
    pub lottery_state: Account<'info, LotteryState>,

    /// CHECK: This is the PDA vault.
    #[account(
        mut,
        seeds = [POT_VAULT_SEED],
        bump = lottery_state.pot_vault_bump
    )]
    pub pot_vault: AccountInfo<'info>,

    /// CHECK: This is the platform wallet
    #[account(
        mut,
        address = lottery_state.platform_wallet
    )]
    pub platform_wallet: AccountInfo<'info>,

   #[account(
        mut,
        seeds = [
            USER_TICKET_SEED,
            &lottery_state.current_lottery_id.to_le_bytes(),
            &(lottery_state.winner - 1).to_le_bytes() 
        ],
        bump,
        constraint = winning_ticket.lottery_id == lottery_state.current_lottery_id @ HashtrologyErrors::InvalidWinner,
        constraint = !winning_ticket.is_winner @ HashtrologyErrors::InvalidWinner,
    )]
    pub winning_ticket: Account<'info, UserTicket>,

    /// CHECK: The wallet of winner
    #[account(
        mut,
        constraint = winner.key() == winning_ticket.user @ HashtrologyErrors::InvalidWinner
    )]
    pub winner: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> Payout<'info> {
    pub fn payout_handler(&mut self) -> Result<()> { 

        let lottery_state = &mut self.lottery_state;

        require!(
            lottery_state.is_drawing,
            HashtrologyErrors::DrawNotRequested
        );
        let winning_ticket = &mut self.winning_ticket;

        let total_pot_balance = self.pot_vault.lamports();
    
        let platform_fee_amount = (total_pot_balance * lottery_state.platform_fee_bps as u64) / 10_000;

        let winner_prize_amount = total_pot_balance
            .checked_sub(platform_fee_amount)
            .ok_or(HashtrologyErrors::Overflow)?;

        // Create signer seeds for pot_vault PDA
        let pot_vault_bump = lottery_state.pot_vault_bump;
        let pot_vault_seeds: &[&[u8]] = &[POT_VAULT_SEED, &[pot_vault_bump]];
        let signer_seeds = &[pot_vault_seeds];

        // Transfer platform fee using invoke_signed
        if platform_fee_amount > 0 {
            transfer(
                CpiContext::new_with_signer(
                    self.system_program.to_account_info(),
                    Transfer {
                        from: self.pot_vault.to_account_info(),
                        to: self.platform_wallet.to_account_info(),
                    },
                    signer_seeds,
                ),
                platform_fee_amount,
            )?;
            msg!("platform fee transferred: {} lamports", platform_fee_amount);
        }

        // Transfer winner prize using invoke_signed
        transfer(
            CpiContext::new_with_signer(
                self.system_program.to_account_info(),
                Transfer {
                    from: self.pot_vault.to_account_info(),
                    to: self.winner.to_account_info(),
                },
                signer_seeds,
            ),
            winner_prize_amount,
        )?;
        msg!("winner prize transferred: {} lamports", winner_prize_amount);

        winning_ticket.is_winner = true;
        winning_ticket.prize_amount = winner_prize_amount;  

        lottery_state.total_participants = 0;
        lottery_state.winner = 0; // Reset winner for the next round
        lottery_state.current_lottery_id = lottery_state.current_lottery_id.checked_add(1).ok_or(HashtrologyErrors::Overflow)?;
        lottery_state.lottery_endtime = lottery_state.lottery_endtime.checked_add(86400).ok_or(HashtrologyErrors::Overflow)?;
        lottery_state.is_drawing = false; 
        lottery_state.commit_slot = 0;

        msg!(
            "Lottery #{} drawn! Winner: {}. Prize: {} lamports.",
            lottery_state.current_lottery_id - 1,
            winning_ticket.user,
            winner_prize_amount
        );
        
        Ok(())
    }
}
