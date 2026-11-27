ALTER TABLE "Household" ADD COLUMN "sleepVersion" INTEGER NOT NULL DEFAULT 0;

CREATE FUNCTION bump_household_sleep_version() RETURNS trigger AS $$
DECLARE
  household_id TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    household_id := OLD."householdId";
  ELSE
    household_id := NEW."householdId";
  END IF;

  UPDATE "Household"
  SET "sleepVersion" = "sleepVersion" + 1
  WHERE id = household_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER sleep_session_change
AFTER INSERT OR UPDATE OR DELETE ON "SleepSession"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION bump_household_sleep_version();

CREATE CONSTRAINT TRIGGER sleep_active_change
AFTER INSERT OR UPDATE OR DELETE ON "ActiveSleep"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION bump_household_sleep_version();

CREATE CONSTRAINT TRIGGER sleep_profile_change
AFTER INSERT OR UPDATE OR DELETE ON "SleepProfile"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION bump_household_sleep_version();

CREATE CONSTRAINT TRIGGER sleep_child_profile_change
AFTER INSERT OR UPDATE OR DELETE ON "ChildProfile"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION bump_household_sleep_version();
