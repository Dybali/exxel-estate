-- One-off conversion of listing prices entered in another currency to Turkish lira (owner's approval,
-- 2026-11-06; docs/listing-currency.md). Listing prices are entered and stored only in TL from now on.
-- Rates: TCMB indicative exchange rates, bulletin 2026/208 dated 05.11.2026
-- (https://www.tcmb.gov.tr/kurlar/today.xml), TL per unit = ForexSelling / Unit.
-- price = ROUND(price * ForexSelling / Unit), currency = 'TRY', updated_at = now, for every listing
-- (any status) whose currency is not TRY and has a rate below; other currencies are left unchanged.
-- Idempotent: only rows with currency <> 'TRY' are touched, so a second run changes nothing.
-- Traceable: each converted listing gets two price_history rows in the format PUT /api/listings/[id]
-- writes for a currency change (old_price = new_price marks a new starting point): the old price in
-- its old currency one millisecond earlier, then the new TL price. The price history then shows the
-- currency change, and no percentage or price-drop alert is computed across the two currencies.
-- The listing trigger (individual_listing_policy, 013/018) is disabled for this one statement: it
-- would start a 20-day expiry on individual listings without expires_at and reject published rows
-- whose expires_at has passed; a currency conversion must not change publication.
-- Applied on the Mittwald container by the startup migration runner (lib/postgres-migrations.ts),
-- in one transaction. Not for scripts/neon-migrate.mjs (it runs statements outside a transaction).
-- SQLite/D1 mirror: drizzle/0027_listing_prices_try.sql (same rates).
ALTER TABLE listings DISABLE TRIGGER individual_listing_policy;
WITH rates(code, forex_selling, unit) AS (VALUES
  ('USD', 50.0489::numeric, 1), ('AUD', 35.1938, 1), ('DKK', 7.5372, 1), ('EUR', 56.2524, 1),
  ('GBP', 67.5420, 1), ('CHF', 61.4571, 1), ('SEK', 5.1550, 1), ('CAD', 35.9165, 1),
  ('KWD', 163.4851, 1), ('NOK', 5.4055, 1), ('SAR', 13.3339, 1), ('JPY', 31.7043, 100),
  ('RON', 10.5908, 1), ('RUB', 0.61518, 1), ('CNY', 7.5465, 1), ('PKR', 0.18197, 1),
  ('QAR', 13.8069, 1), ('KRW', 0.03751, 1), ('AZN', 29.6052, 1), ('AED', 13.7035, 1),
  ('KZT', 0.11146, 1)
), stamp AS (
  SELECT clock_timestamp() AS ts
), changed AS (
  UPDATE listings l
     SET price = GREATEST(1, ROUND(l.price * r.forex_selling / r.unit))::bigint,
         currency = 'TRY',
         updated_at = to_char((SELECT ts FROM stamp) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    FROM rates r, listings prev
   WHERE prev.id = l.id AND l.currency = r.code AND l.currency <> 'TRY'
  RETURNING l.id, prev.price AS old_price, prev.currency AS old_currency, l.price AS new_price, l.purpose
)
INSERT INTO price_history(id, listing_id, old_price, new_price, currency, purpose, changed_at)
SELECT gen_random_uuid(), id, old_price, old_price, old_currency, purpose,
       to_char(((SELECT ts FROM stamp) - interval '1 millisecond') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  FROM changed
UNION ALL
SELECT gen_random_uuid(), id, new_price, new_price, 'TRY', purpose,
       to_char((SELECT ts FROM stamp) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  FROM changed;
ALTER TABLE listings ENABLE TRIGGER individual_listing_policy;
