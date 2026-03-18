-- ============================================================
-- Atomic trade execution function
-- Wraps trade insert + cash adjust + position upsert/reduce
-- in a single PostgreSQL transaction (all-or-nothing).
-- ============================================================

CREATE OR REPLACE FUNCTION execute_trade_atomic(
  p_account_id UUID,
  p_symbol     TEXT,
  p_side       TEXT,
  p_shares     INTEGER,
  p_price      NUMERIC,
  p_total      NUMERIC,
  p_fee        NUMERIC,
  p_reasoning  TEXT
)
RETURNS UUID AS $$
DECLARE
  v_trade_id    UUID;
  v_existing    RECORD;
  v_total_shares INTEGER;
  v_avg_cost    NUMERIC;
BEGIN
  -- Validate inputs
  IF p_side NOT IN ('buy', 'sell') THEN
    RAISE EXCEPTION 'Invalid side: %', p_side;
  END IF;
  IF p_shares <= 0 THEN
    RAISE EXCEPTION 'Shares must be positive';
  END IF;
  IF p_price <= 0 THEN
    RAISE EXCEPTION 'Price must be positive';
  END IF;

  -- 1. Record the trade
  INSERT INTO trades (account_id, symbol, side, shares, price, total, fee, reasoning)
  VALUES (p_account_id, p_symbol, p_side, p_shares, p_price, p_total, p_fee, p_reasoning)
  RETURNING id INTO v_trade_id;

  -- 2. Adjust cash
  IF p_side = 'buy' THEN
    UPDATE accounts SET cash = cash - (p_total + p_fee) WHERE id = p_account_id;
  ELSE
    UPDATE accounts SET cash = cash + (p_total - p_fee) WHERE id = p_account_id;
  END IF;

  -- Verify cash didn't go negative
  IF (SELECT cash FROM accounts WHERE id = p_account_id) < 0 THEN
    RAISE EXCEPTION 'Insufficient cash';
  END IF;

  -- 3. Update position
  SELECT * INTO v_existing
    FROM positions
   WHERE account_id = p_account_id AND symbol = p_symbol;

  IF p_side = 'buy' THEN
    IF FOUND THEN
      v_total_shares := v_existing.shares + p_shares;
      v_avg_cost := ROUND(
        (v_existing.avg_cost * v_existing.shares + p_price * p_shares)
        / v_total_shares, 2
      );
      UPDATE positions
         SET shares = v_total_shares,
             avg_cost = v_avg_cost,
             updated_at = now()
       WHERE id = v_existing.id;
    ELSE
      INSERT INTO positions (account_id, symbol, shares, avg_cost)
      VALUES (p_account_id, p_symbol, p_shares, p_price);
    END IF;

  ELSE  -- sell
    IF NOT FOUND THEN
      RAISE EXCEPTION 'No position found for %', p_symbol;
    END IF;
    IF v_existing.shares < p_shares THEN
      RAISE EXCEPTION 'Insufficient shares for %: have %, want to sell %',
        p_symbol, v_existing.shares, p_shares;
    END IF;

    IF v_existing.shares - p_shares = 0 THEN
      DELETE FROM positions WHERE id = v_existing.id;
    ELSE
      UPDATE positions
         SET shares = v_existing.shares - p_shares,
             updated_at = now()
       WHERE id = v_existing.id;
    END IF;
  END IF;

  RETURN v_trade_id;
END;
$$ LANGUAGE plpgsql;
