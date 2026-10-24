CREATE TABLE "ChildProfile" (
  "id" TEXT NOT NULL,
  "householdId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "birthDate" TIMESTAMP(3),
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChildProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChildProfile_householdId_key" ON "ChildProfile"("householdId");
ALTER TABLE "ChildProfile" ADD CONSTRAINT "ChildProfile_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChildProfile" ADD CONSTRAINT "ChildProfile_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "ChildProfile" ("id", "householdId", "name", "birthDate", "updatedById", "createdAt", "updatedAt")
SELECT "id", "householdId", COALESCE(NULLIF(TRIM("babyName"), ''), 'Дитина'), "birthDate", "updatedById", "createdAt", "updatedAt"
FROM "SleepProfile"
WHERE "birthDate" IS NOT NULL OR (TRIM("babyName") NOT IN ('', 'Дитина', 'Соломія'));

-- An older deployment may still write the legacy profile while this migration runs.
CREATE FUNCTION "sync_legacy_sleep_child_profile"() RETURNS trigger AS $$
BEGIN
  IF NEW."birthDate" IS NULL AND TRIM(NEW."babyName") IN ('', 'Дитина', 'Соломія') THEN
    IF TG_OP = 'UPDATE' THEN
      DELETE FROM "ChildProfile" WHERE "householdId" = NEW."householdId";
    END IF;
  ELSE
    INSERT INTO "ChildProfile" ("id", "householdId", "name", "birthDate", "updatedById", "createdAt", "updatedAt")
    VALUES (NEW."id", NEW."householdId", COALESCE(NULLIF(TRIM(NEW."babyName"), ''), 'Дитина'), NEW."birthDate", NEW."updatedById", NEW."createdAt", NEW."updatedAt")
    ON CONFLICT ("householdId") DO UPDATE SET
      "name" = EXCLUDED."name",
      "birthDate" = EXCLUDED."birthDate",
      "updatedById" = EXCLUDED."updatedById",
      "updatedAt" = EXCLUDED."updatedAt";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "SleepProfile_sync_legacy_child"
AFTER INSERT OR UPDATE OF "babyName", "birthDate" ON "SleepProfile"
FOR EACH ROW EXECUTE FUNCTION "sync_legacy_sleep_child_profile"();

-- Keep legacy columns until the previous API deployment is no longer serving traffic.
ALTER TABLE "SleepProfile" ALTER COLUMN "babyName" SET DEFAULT 'Дитина';
