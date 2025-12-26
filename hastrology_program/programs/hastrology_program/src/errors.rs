use anchor_lang::prelude::*;

#[error_code]
pub enum HashtrologyErrors {
    #[msg("Math Overflow")]
    Overflow,

    // --- Initialize Errors ---
    #[msg("The platform fee must be 10,000 (100%) or less.")]
    InvalidPlatformFee,

    #[msg("The ticket price cannot be zero.")]
    InvalidTicketPrice,

    // --- EnterLottery Errors ---
    #[msg("The lottery is currently drawing a winner. Please try again later.")]
    LotteryIsDrawing,
    
    // --- RequestDraw Errors ---
    #[msg("The lottery is not over yet. Cannot request a draw.")]
    LotteryNotOver,

    #[msg("The randomness account is invalid.")]
    InvalidRandomnessAccount,
    
    #[msg("The randomness slot is not the previous slot.")]
    InvalidRandomnessSlot,

    #[msg("A draw has already been requested for this lottery.")]
    DrawAlreadyRequested,
    
    #[msg("The signer is not the authorized keeper.")]
    UnauthorizedAuthority,
    
    #[msg("The winning ticket account is invalid.")]
    InvalidWinner,
    
    #[msg("The provided VRF account does not match the one in state.")]
    InvalidVrfAccount,

    #[msg("The provided Switchboard program ID is incorrect.")]
    InvalidSwitchboardProgram,

    #[msg("already revealed")]
    RandomnessAlreadyRevealed,

    // --- ReceiveDraw Errors ---
    #[msg("No draw has been requested for this lottery.")]
    DrawNotRequested,

    #[msg("The randomness request has expired.")]
    RandomnessExpired,
    
    #[msg("The randomness result has not been revealed yet.")]
    RandomnessNotResolved,

    #[msg("The oracle's random number result is not ready yet.")]
    VrfResultNotReady,

    #[msg("Cannot rollover a lottery that has participants. Use request_draw instead.")]
    CannotRolloverWithPlayers,

    // --- UpdateConfig Errors ---
    #[msg("Only the authority can perform this action.")]
    Unauthorized,

    #[msg("The new lottery endtime must be in the future.")]
    InvalidEndtime,
}