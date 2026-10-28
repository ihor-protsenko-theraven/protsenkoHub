CREATE TYPE "FeedingStatus" AS ENUM ('PENDING', 'INTRODUCED', 'ALLERGY', 'REFUSED');

CREATE TABLE "FoodCategory" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "FoodCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FoodItem" (
  "id" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "allowedFromAgeMonths" INTEGER NOT NULL,
  "preparationGuide" TEXT NOT NULL,
  "isAllergen" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "FoodItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FeedingRecord" (
  "id" TEXT NOT NULL,
  "childId" TEXT NOT NULL,
  "foodItemId" TEXT NOT NULL,
  "status" "FeedingStatus" NOT NULL DEFAULT 'PENDING',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FeedingRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FoodItem_categoryId_sortOrder_idx" ON "FoodItem"("categoryId", "sortOrder");
CREATE UNIQUE INDEX "FeedingRecord_childId_foodItemId_key" ON "FeedingRecord"("childId", "foodItemId");
CREATE INDEX "FeedingRecord_childId_idx" ON "FeedingRecord"("childId");

ALTER TABLE "FoodItem" ADD CONSTRAINT "FoodItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FoodCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeedingRecord" ADD CONSTRAINT "FeedingRecord_childId_fkey" FOREIGN KEY ("childId") REFERENCES "ChildProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeedingRecord" ADD CONSTRAINT "FeedingRecord_foodItemId_fkey" FOREIGN KEY ("foodItemId") REFERENCES "FoodItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
