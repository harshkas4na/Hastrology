use anchor_lang::prelude::*;

use crate::{
    constants::LOTTERY_STATE_SEED, 
    errors::HashtrologyErrors, 
    state::LotteryState
};

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(
        constraint = authority.key() == lottery_state.authority @ HashtrologyErrors::Unauthorized
    )]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [LOTTERY_STATE_SEED],
        bump = lottery_state.lottery_state_bump
    )]
    pub lottery_state: Account<'info, LotteryState>,
}

impl<'info> UpdateConfig<'info> {
    pub fn update_config_handler(
        &mut self,
        new_ticket_price: Option<u64>,
        new_platform_fee_bps: Option<u16>,
        new_platform_wallet: Option<Pubkey>,
        new_lottery_endtime: Option<i64>,
        reset_winner: Option<bool>,
        reset_drawing: Option<bool>,
    ) -> Result<()> {
        let lottery_state = &mut self.lottery_state;

        // Update ticket price if provided
        if let Some(price) = new_ticket_price {
            require!(
                price > 0, 
                HashtrologyErrors::InvalidTicketPrice
            );
            msg!("Updating ticket price from {} to {}", lottery_state.ticket_price, price);
            lottery_state.ticket_price = price;
        }

        // Update platform fee if provided
        if let Some(fee_bps) = new_platform_fee_bps {
            require!(
                fee_bps <= 10_000, 
                HashtrologyErrors::InvalidPlatformFee
            );
            msg!("Updating platform fee from {} to {} bps", lottery_state.platform_fee_bps, fee_bps);
            lottery_state.platform_fee_bps = fee_bps;
        }

        // Update platform wallet if provided
        if let Some(wallet) = new_platform_wallet {
            msg!("Updating platform wallet to {}", wallet);
            lottery_state.platform_wallet = wallet;
        }

        // Update lottery endtime if provided
        if let Some(endtime) = new_lottery_endtime {
            let clock = Clock::get()?;
            require!(
                endtime > clock.unix_timestamp,
                HashtrologyErrors::InvalidEndtime
            );
            msg!("Updating lottery endtime from {} to {}", lottery_state.lottery_endtime, endtime);
            lottery_state.lottery_endtime = endtime;
        }

        if let Some(true) = reset_winner {
            msg!("Resetting winner from {} to 0", lottery_state.winner);
            lottery_state.winner = 0;
        }

        if let Some(true) = reset_drawing {
            msg!("Resetting is_drawing from {} to false", lottery_state.is_drawing);
            lottery_state.is_drawing = false;
        }

        msg!("Config updated successfully");
        
        Ok(())
    }
}
