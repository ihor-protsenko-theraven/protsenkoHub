import {
  PrismaClient,
  MemberRole,
  ContactCategory,
  TaskStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Demo seed is disabled in production');
  }
  const passwordHash = await bcrypt.hash('protsenko123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@protsenkohub.local' },
    update: {},
    create: {
      email: 'admin@protsenkohub.local',
      passwordHash,
      displayName: 'Ігор',
    },
  });

  const partner = await prisma.user.upsert({
    where: { email: 'family@protsenkohub.local' },
    update: {},
    create: {
      email: 'family@protsenkohub.local',
      passwordHash,
      displayName: 'Сімʼя',
    },
  });

  const household = await prisma.household.upsert({
    where: { id: 'seed-household-protsenko' },
    update: { name: 'Сімʼя Проценко' },
    create: {
      id: 'seed-household-protsenko',
      name: 'Сімʼя Проценко',
      timezone: 'Europe/Kyiv',
    },
  });

  const adminMember = await prisma.membership.upsert({
    where: {
      userId_householdId: { userId: admin.id, householdId: household.id },
    },
    update: {},
    create: {
      userId: admin.id,
      householdId: household.id,
      role: MemberRole.ADMIN,
      color: '#2F6F5E',
      displayName: 'Ігор',
    },
  });

  await prisma.membership.upsert({
    where: {
      userId_householdId: { userId: partner.id, householdId: household.id },
    },
    update: {},
    create: {
      userId: partner.id,
      householdId: household.id,
      role: MemberRole.MEMBER,
      color: '#C45C26',
      displayName: 'Сімʼя',
    },
  });

  const list = await prisma.shoppingList.upsert({
    where: { id: 'seed-shopping-list' },
    update: {},
    create: {
      id: 'seed-shopping-list',
      householdId: household.id,
      name: 'Продукти',
      items: {
        create: [
          {
            name: 'Молоко',
            qty: 1,
            unit: 'л',
            category: 'Молочка',
            sortOrder: 0,
          },
          {
            name: 'Хліб',
            qty: 1,
            unit: 'шт',
            category: 'Випічка',
            sortOrder: 1,
          },
          {
            name: 'Яблука',
            qty: 6,
            unit: 'шт',
            category: 'Фрукти',
            sortOrder: 2,
          },
        ],
      },
    },
  });

  if (!(await prisma.event.count({ where: { householdId: household.id } }))) {
    const start = new Date();
    start.setHours(18, 0, 0, 0);
    const end = new Date(start);
    end.setHours(19, 0, 0, 0);
    await prisma.event.create({
      data: {
        householdId: household.id,
        memberId: adminMember.id,
        title: 'Вечірня прогулянка',
        notes: 'Парк біля дому',
        startsAt: start,
        endsAt: end,
      },
    });
  }

  if (
    !(await prisma.solomiyaTask.count({ where: { householdId: household.id } }))
  ) {
    await prisma.solomiyaTask.createMany({
      data: [
        {
          householdId: household.id,
          title: 'Підготувати одяг у садочок',
          status: TaskStatus.TODO,
          priority: 2,
          assigneeId: admin.id,
          dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
        {
          householdId: household.id,
          title: 'Записатись до педіатра',
          status: TaskStatus.IN_PROGRESS,
          priority: 3,
          assigneeId: partner.id,
        },
      ],
    });
  }

  if (!(await prisma.contact.count({ where: { householdId: household.id } }))) {
    await prisma.contact.createMany({
      data: [
        {
          householdId: household.id,
          name: 'Педіатр Коваль',
          category: ContactCategory.DOCTOR,
          phone: '+380501112233',
          organization: 'Дитяча поліклініка',
          notes: 'Кабінет 12',
        },
        {
          householdId: household.id,
          name: 'Репетитор з англійської',
          category: ContactCategory.TUTOR,
          phone: '+380671234567',
          email: 'tutor@example.com',
        },
      ],
    });
  }

  console.log('Seed OK');
  console.log('  admin@protsenkohub.local / protsenko123');
  console.log('  family@protsenkohub.local / protsenko123');
  console.log('  shopping list:', list.id);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
