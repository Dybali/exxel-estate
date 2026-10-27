ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "whatsapp_enabled" INTEGER NOT NULL DEFAULT 0;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='users_whatsapp_enabled_check' AND conrelid='users'::regclass) THEN
    ALTER TABLE "users" ADD CONSTRAINT "users_whatsapp_enabled_check" CHECK ("whatsapp_enabled" IN (0,1));
  END IF;
END $$;
