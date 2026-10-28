import { PrismaClient } from '@prisma/client';
import { FEEDING_DICTIONARY } from './feeding-dictionary.config';

export async function ensureFeedingDictionary(
  prisma: PrismaClient,
): Promise<void> {
  await prisma.$transaction(
    FEEDING_DICTIONARY.flatMap((category) => [
      prisma.foodCategory.upsert({
        where: { id: category.id },
        create: {
          id: category.id,
          name: category.name,
          sortOrder: category.sortOrder,
        },
        update: {
          name: category.name,
          sortOrder: category.sortOrder,
        },
      }),
      ...category.items.map((item) =>
        prisma.foodItem.upsert({
          where: { id: item.id },
          create: {
            id: item.id,
            categoryId: category.id,
            name: item.name,
            allowedFromAgeMonths: item.allowedFromAgeMonths,
            preparationGuide: item.preparationGuide,
            isAllergen: item.isAllergen,
            sortOrder: item.sortOrder,
          },
          update: {
            categoryId: category.id,
            name: item.name,
            allowedFromAgeMonths: item.allowedFromAgeMonths,
            preparationGuide: item.preparationGuide,
            isAllergen: item.isAllergen,
            sortOrder: item.sortOrder,
          },
        }),
      ),
    ]),
  );
}
