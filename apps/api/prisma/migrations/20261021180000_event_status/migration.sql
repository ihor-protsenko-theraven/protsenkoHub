CREATE TYPE "EventStatus" AS ENUM ('OPEN', 'DONE');

ALTER TABLE "Event" ADD COLUMN "status" "EventStatus" NOT NULL DEFAULT 'OPEN';

CREATE INDEX "Event_householdId_status_startsAt_idx" ON "Event"("householdId", "status", "startsAt");
