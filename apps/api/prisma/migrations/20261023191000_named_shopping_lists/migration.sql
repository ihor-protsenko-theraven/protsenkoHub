-- The previous API creates its single shopping list without this field.
ALTER TABLE "ShoppingList" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT true;

UPDATE "ShoppingList" AS list
SET "isDefault" = (list."id" = (
  SELECT first_list."id"
  FROM "ShoppingList" AS first_list
  WHERE first_list."householdId" = list."householdId"
  ORDER BY first_list."createdAt" ASC, first_list."id" ASC
  LIMIT 1
));

CREATE UNIQUE INDEX "ShoppingList_one_default_per_household"
ON "ShoppingList"("householdId") WHERE "isDefault" = true;
