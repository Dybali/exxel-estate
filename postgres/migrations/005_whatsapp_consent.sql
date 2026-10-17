ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_enabled integer NOT NULL DEFAULT 0;
ALTER TABLE users ADD CONSTRAINT users_whatsapp_enabled_check CHECK (whatsapp_enabled IN (0,1));
