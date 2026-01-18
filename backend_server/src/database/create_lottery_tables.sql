-- Create lottery_draws table
CREATE TABLE IF NOT EXISTS lottery_draws (
    id SERIAL PRIMARY KEY,
    lottery_id BIGINT UNIQUE NOT NULL,
    draw_time TIMESTAMPTZ DEFAULT NOW(),
    winner_wallet TEXT,
    prize_amount NUMERIC,
    total_participants INTEGER,
    winning_ticket_index INTEGER,
    transaction_signature TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create lottery_participants table
CREATE TABLE IF NOT EXISTS lottery_participants (
    lottery_id BIGINT NOT NULL REFERENCES lottery_draws(lottery_id),
    wallet_address TEXT NOT NULL,
    is_winner BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (lottery_id, wallet_address)
);

-- Create index for faster lookups by wallet
CREATE INDEX IF NOT EXISTS idx_lottery_participants_wallet ON lottery_participants(wallet_address);
