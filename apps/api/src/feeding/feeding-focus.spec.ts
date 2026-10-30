import { FeedingStatus } from '@prisma/client';
import { pickFeedingFocus, type FeedingPlanCategory } from './feeding-focus';

const plan: FeedingPlanCategory[] = [
  {
    name: 'Овочі',
    sortOrder: 1,
    items: [
      food('food-zucchini', 'Кабачок', 1, 6),
      food('food-carrot', 'Морква', 2, 7),
    ],
  },
  {
    name: 'Каші',
    sortOrder: 2,
    items: [food('food-buckwheat', 'Гречана каша', 1, 6)],
  },
  {
    name: 'Фрукти',
    sortOrder: 3,
    items: [food('food-apple', 'Яблуко', 1, 7)],
  },
];

describe('pickFeedingFocus', () => {
  it('starts with the earliest open food and the one after it', () => {
    expect(pickFeedingFocus(plan, [], 6)).toEqual({
      introduced: null,
      current: named('food-zucchini', 'Кабачок', 'Овочі', 6),
      next: named('food-buckwheat', 'Гречана каша', 'Каші', 6),
    });
  });

  it('shows the latest introduced food and the next open food after it', () => {
    const vegetablesPlan: FeedingPlanCategory[] = [
      {
        name: 'Овочі',
        sortOrder: 1,
        items: [
          food('food-zucchini', 'Кабачок', 1, 5),
          food('food-cauliflower', 'Цвітна капуста', 2, 5),
          food('food-pumpkin', 'Гарбуз', 3, 5),
        ],
      },
    ];

    expect(
      pickFeedingFocus(
        vegetablesPlan,
        [{ foodItemId: 'food-zucchini', status: FeedingStatus.INTRODUCED }],
        6,
      ),
    ).toEqual({
      introduced: named('food-zucchini', 'Кабачок', 'Овочі', 5),
      current: named('food-cauliflower', 'Цвітна капуста', 'Овочі', 5),
      next: named('food-cauliflower', 'Цвітна капуста', 'Овочі', 5),
    });

    expect(
      pickFeedingFocus(
        vegetablesPlan,
        [
          { foodItemId: 'food-zucchini', status: FeedingStatus.INTRODUCED },
          { foodItemId: 'food-cauliflower', status: FeedingStatus.INTRODUCED },
        ],
        6,
      ),
    ).toEqual({
      introduced: named('food-cauliflower', 'Цвітна капуста', 'Овочі', 5),
      current: named('food-pumpkin', 'Гарбуз', 'Овочі', 5),
      next: named('food-pumpkin', 'Гарбуз', 'Овочі', 5),
    });
  });

  it('skips foods already introduced, refused, or marked as allergy', () => {
    expect(
      pickFeedingFocus(
        plan,
        [
          { foodItemId: 'food-zucchini', status: FeedingStatus.INTRODUCED },
          { foodItemId: 'food-buckwheat', status: FeedingStatus.ALLERGY },
        ],
        6,
      ),
    ).toEqual({
      introduced: named('food-zucchini', 'Кабачок', 'Овочі', 6),
      current: null,
      next: named('food-carrot', 'Морква', 'Овочі', 7),
    });
  });

  it('keeps a pending food in the queue and does not offer later foods first', () => {
    expect(
      pickFeedingFocus(
        plan,
        [{ foodItemId: 'food-zucchini', status: FeedingStatus.PENDING }],
        8,
      ),
    ).toEqual({
      introduced: null,
      current: named('food-zucchini', 'Кабачок', 'Овочі', 6),
      next: named('food-buckwheat', 'Гречана каша', 'Каші', 6),
    });
  });

  it('holds the plan until the child reaches the first age', () => {
    expect(pickFeedingFocus(plan, [], 5)).toEqual({
      introduced: null,
      current: null,
      next: named('food-zucchini', 'Кабачок', 'Овочі', 6),
    });
  });

  it('follows dictionary order when the birth date is unknown', () => {
    expect(pickFeedingFocus(plan, [], null)).toEqual({
      introduced: null,
      current: named('food-zucchini', 'Кабачок', 'Овочі', 6),
      next: named('food-buckwheat', 'Гречана каша', 'Каші', 6),
    });
  });
});

function food(
  id: string,
  name: string,
  sortOrder: number,
  allowedFromAgeMonths: number,
) {
  return {
    id,
    name,
    sortOrder,
    allowedFromAgeMonths,
    isAllergen: false,
    preparationGuide: 'Крок',
  };
}

function named(
  id: string,
  name: string,
  categoryName: string,
  allowedFromAgeMonths: number,
) {
  return {
    id,
    name,
    categoryName,
    allowedFromAgeMonths,
    isAllergen: false,
    preparationGuide: 'Крок',
  };
}
