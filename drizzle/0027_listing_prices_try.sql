-- One-off conversion of listing prices to Turkish lira; mirrors
-- postgres/migrations/020_listing_prices_try.sql (TCMB bulletin 2026/208 dated 05.11.2026,
-- TL per unit = ForexSelling / Unit). Only rows with currency <> 'TRY' and a rate are touched, so a
-- second run changes nothing. Two price_history rows per converted listing (old price in the old
-- currency one millisecond earlier, then the TL price), as PUT /api/listings/[id] records a currency
-- change. SQLite cannot switch triggers off: a published listing whose expires_at has passed would be
-- rejected by listing_expiry_guard, so such rows are left as they are (the app converts them for
-- display with the current TCMB bulletin).
INSERT INTO price_history(id,listing_id,old_price,new_price,currency,purpose,changed_at)
WITH rates(code,forex_selling,unit) AS (VALUES
 ('USD',50.0489,1),('AUD',35.1938,1),('DKK',7.5372,1),('EUR',56.2524,1),('GBP',67.5420,1),('CHF',61.4571,1),
 ('SEK',5.1550,1),('CAD',35.9165,1),('KWD',163.4851,1),('NOK',5.4055,1),('SAR',13.3339,1),('JPY',31.7043,100),
 ('RON',10.5908,1),('RUB',0.61518,1),('CNY',7.5465,1),('PKR',0.18197,1),('QAR',13.8069,1),('KRW',0.03751,1),
 ('AZN',29.6052,1),('AED',13.7035,1),('KZT',0.11146,1))
SELECT lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-4'||substr(hex(randomblob(2)),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(hex(randomblob(2)),2)||'-'||hex(randomblob(6))),
 l.id,l.price,l.price,l.currency,l.purpose,strftime('%Y-%m-%dT%H:%M:%fZ','now','-0.001 seconds')
FROM listings l JOIN rates r ON r.code=l.currency
WHERE l.currency<>'TRY' AND NOT (l.status='published' AND l.expires_at IS NOT NULL AND l.expires_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now'));
--> statement-breakpoint
INSERT INTO price_history(id,listing_id,old_price,new_price,currency,purpose,changed_at)
WITH rates(code,forex_selling,unit) AS (VALUES
 ('USD',50.0489,1),('AUD',35.1938,1),('DKK',7.5372,1),('EUR',56.2524,1),('GBP',67.5420,1),('CHF',61.4571,1),
 ('SEK',5.1550,1),('CAD',35.9165,1),('KWD',163.4851,1),('NOK',5.4055,1),('SAR',13.3339,1),('JPY',31.7043,100),
 ('RON',10.5908,1),('RUB',0.61518,1),('CNY',7.5465,1),('PKR',0.18197,1),('QAR',13.8069,1),('KRW',0.03751,1),
 ('AZN',29.6052,1),('AED',13.7035,1),('KZT',0.11146,1))
SELECT lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-4'||substr(hex(randomblob(2)),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(hex(randomblob(2)),2)||'-'||hex(randomblob(6))),
 l.id,MAX(1,CAST(ROUND(l.price*r.forex_selling/r.unit) AS INTEGER)),MAX(1,CAST(ROUND(l.price*r.forex_selling/r.unit) AS INTEGER)),'TRY',l.purpose,strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM listings l JOIN rates r ON r.code=l.currency
WHERE l.currency<>'TRY' AND NOT (l.status='published' AND l.expires_at IS NOT NULL AND l.expires_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now'));
--> statement-breakpoint
WITH rates(code,forex_selling,unit) AS (VALUES
 ('USD',50.0489,1),('AUD',35.1938,1),('DKK',7.5372,1),('EUR',56.2524,1),('GBP',67.5420,1),('CHF',61.4571,1),
 ('SEK',5.1550,1),('CAD',35.9165,1),('KWD',163.4851,1),('NOK',5.4055,1),('SAR',13.3339,1),('JPY',31.7043,100),
 ('RON',10.5908,1),('RUB',0.61518,1),('CNY',7.5465,1),('PKR',0.18197,1),('QAR',13.8069,1),('KRW',0.03751,1),
 ('AZN',29.6052,1),('AED',13.7035,1),('KZT',0.11146,1))
UPDATE listings
SET price=MAX(1,CAST(ROUND(price*(SELECT forex_selling/unit FROM rates WHERE code=listings.currency)) AS INTEGER)),
 currency='TRY',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE currency<>'TRY' AND currency IN (SELECT code FROM rates)
 AND NOT (status='published' AND expires_at IS NOT NULL AND expires_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now'));
