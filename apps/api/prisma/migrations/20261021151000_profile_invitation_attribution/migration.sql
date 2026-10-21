ALTER TABLE "HouseholdInvitation" ADD COLUMN "createdById" TEXT;
ALTER TABLE "SleepProfile" ADD COLUMN "updatedById" TEXT;

ALTER TABLE "HouseholdInvitation" ADD CONSTRAINT "HouseholdInvitation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SleepProfile" ADD CONSTRAINT "SleepProfile_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
