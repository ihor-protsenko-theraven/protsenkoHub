CREATE INDEX IF NOT EXISTS "Event_householdId_status_endsAt_idx" ON "Event"("householdId", "status", "endsAt");
CREATE INDEX IF NOT EXISTS "SleepSession_householdId_endedAt_idx" ON "SleepSession"("householdId", "endedAt");
