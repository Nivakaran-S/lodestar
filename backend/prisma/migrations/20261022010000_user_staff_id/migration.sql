-- A loader's staff ID (KDY-0427) for the Dock sign-in (LD-06): listed on ADM-03 and unique across people. Keycloak
-- keeps the same value as the `staff_id` user attribute, which the sign-in extension looks the loader up by.
-- Additive only; IF NOT EXISTS so a database that already has it migrates cleanly.

ALTER TABLE "auth"."User" ADD COLUMN IF NOT EXISTS "staffId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_staffId_key" ON "auth"."User"("staffId");

-- The seeded loader (backend/prisma/scenario.ts, realm user kasun).
UPDATE "auth"."User" SET "staffId" = 'KDY-0427'
  WHERE "id" = '8f1c2a10-0001-4c6e-9a01-000000000003' AND "staffId" IS NULL
    AND NOT EXISTS (SELECT 1 FROM "auth"."User" WHERE "staffId" = 'KDY-0427');
