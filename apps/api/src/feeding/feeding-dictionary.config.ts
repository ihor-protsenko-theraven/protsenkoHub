import type { FeedingDictionaryCategory } from './feeding.model';

function steps(...lines: readonly string[]): string {
  return lines.join('\n');
}

export const FEEDING_DICTIONARY: readonly FeedingDictionaryCategory[] = [
  {
    id: 'cat-vegetables',
    name: 'Овочі',
    sortOrder: 1,
    items: [
      {
        id: 'food-zucchini',
        name: 'Кабачок',
        allowedFromAgeMonths: 5,
        isAllergen: false,
        sortOrder: 1,
        preparationGuide: steps(
          'Помийте кабачок. Молодий можна не чистити, стиглий очистіть від шкірки.',
          'Наріжте шматочками.',
          'Готуйте на парі або відваріть 10–15 хвилин до м’якості.',
          'Подрібніть блендером до однорідного пюре.',
          'За потреби додайте трохи кип’яченої води. Почніть з 1–2 чайних ложок, без солі.',
        ),
      },
      {
        id: 'food-cauliflower',
        name: 'Цвітна капуста',
        allowedFromAgeMonths: 5,
        isAllergen: false,
        sortOrder: 2,
        preparationGuide: steps(
          'Розділіть капусту на суцвіття.',
          'Готуйте на парі або відваріть 10–15 хвилин до м’якості.',
          'Подрібніть блендером до однорідної консистенції.',
          'За потреби додайте трохи води. Почніть з 1–2 чайних ложок.',
        ),
      },
      {
        id: 'food-broccoli',
        name: 'Броколі',
        allowedFromAgeMonths: 5,
        isAllergen: false,
        sortOrder: 3,
        preparationGuide: steps(
          'Розділіть броколі на суцвіття.',
          'Готуйте на парі або відваріть 8–12 хвилин до м’якості.',
          'Подрібніть блендером до однорідної консистенції.',
          'За потреби додайте трохи води. Почніть з 1–2 чайних ложок.',
        ),
      },
      {
        id: 'food-pumpkin',
        name: 'Гарбуз',
        allowedFromAgeMonths: 5,
        isAllergen: false,
        sortOrder: 4,
        preparationGuide: steps(
          'Очистіть гарбуз від шкірки та насіння.',
          'Наріжте шматочками.',
          'Запікайте або варіть на парі до м’якості.',
          'Подрібніть блендером до пюре. Почніть з 1–2 чайних ложок.',
        ),
      },
      {
        id: 'food-carrot',
        name: 'Морква',
        allowedFromAgeMonths: 7,
        isAllergen: false,
        sortOrder: 5,
        preparationGuide: steps(
          'Очистіть моркву і наріжте шматочками.',
          'Готуйте на парі або відваріть 10–15 хвилин до м’якості.',
          'Подрібніть блендером до однорідного пюре.',
          'За потреби додайте трохи води або грудного молока.',
          'Почніть з 1–2 чайних ложок. Давайте не щодня: морква насичена каротином.',
        ),
      },
      {
        id: 'food-potato',
        name: 'Картопля',
        allowedFromAgeMonths: 7,
        isAllergen: false,
        sortOrder: 6,
        preparationGuide: steps(
          'Запечіть або відваріть картоплю і розімніть з овочевим відваром.',
          'Молоко не додавайте, поки його не введено.',
          'Почніть з 1–2 чайних ложок, без солі.',
        ),
      },
      {
        id: 'food-sweetcorn',
        name: 'Кукурудза',
        allowedFromAgeMonths: 6,
        isAllergen: false,
        sortOrder: 7,
        preparationGuide: steps(
          'Візьміть молоду кукурудзу, свіжу або заморожену.',
          'Очистіть від шкірки та приготуйте на парі 10–15 хвилин.',
          'Збийте блендером до однорідної консистенції.',
          'За потреби додайте трохи води. Почніть з 1–2 чайних ложок.',
        ),
      },
    ],
  },
  {
    id: 'cat-porridge',
    name: 'Каші',
    sortOrder: 2,
    items: [
      {
        id: 'food-buckwheat',
        name: 'Гречана каша',
        allowedFromAgeMonths: 5,
        isAllergen: false,
        sortOrder: 1,
        preparationGuide: steps(
          'Візьміть дитячу гречану кашу без цукру, збагачену залізом.',
          'Готуйте на воді за інструкцією на упаковці.',
          'Грудне молоко чи суміш додайте вже перед годуванням, якщо хочете густішу кашу.',
          'Зачекайте, поки каша охолоне. Почніть з 1–2 чайних ложок.',
        ),
      },
      {
        id: 'food-rice',
        name: 'Рисова каша',
        allowedFromAgeMonths: 5,
        isAllergen: false,
        sortOrder: 2,
        preparationGuide: steps(
          'Візьміть дитячу рисову кашу без цукру, збагачену залізом.',
          'Готуйте на воді за інструкцією на упаковці.',
          'Грудне молоко чи суміш додайте вже перед годуванням, якщо хочете густішу кашу.',
          'Зачекайте, поки каша охолоне. Почніть з 1–2 чайних ложок і чергуйте з гречкою.',
        ),
      },
      {
        id: 'food-corn',
        name: 'Кукурудзяна каша',
        allowedFromAgeMonths: 7,
        isAllergen: false,
        sortOrder: 3,
        preparationGuide: steps(
          'Візьміть дитячу кукурудзяну кашу без цукру. Вона без глютену.',
          'Готуйте на воді за інструкцією на упаковці.',
          'Грудне молоко чи суміш додайте вже перед годуванням, якщо хочете густішу кашу.',
          'Зачекайте, поки каша охолоне. Почніть з 1–2 чайних ложок.',
        ),
      },
      {
        id: 'food-oat',
        name: 'Вівсяна каша',
        allowedFromAgeMonths: 7,
        isAllergen: true,
        sortOrder: 4,
        preparationGuide: steps(
          'Візьміть дитячу вівсяну кашу без цукру, збагачену залізом.',
          'Готуйте на воді за інструкцією на упаковці.',
          'За потреби розводьте грудним молоком або водою, якщо це дозволяє виробник.',
          'Містить глютен: вводьте окремо від інших нових продуктів. Почніть з 1–2 чайних ложок.',
        ),
      },
      {
        id: 'food-millet',
        name: 'Пшоняна каша',
        allowedFromAgeMonths: 8,
        isAllergen: false,
        sortOrder: 5,
        preparationGuide: steps(
          'Добре промийте пшоно і зваріть на воді.',
          'Розімніть. Молоко додайте лише після того, як його введено.',
          'Почніть з 1–2 чайних ложок, без цукру.',
        ),
      },
    ],
  },
  {
    id: 'cat-fruits',
    name: 'Фрукти',
    sortOrder: 3,
    items: [
      {
        id: 'food-apple',
        name: 'Яблуко',
        allowedFromAgeMonths: 6,
        isAllergen: false,
        sortOrder: 1,
        preparationGuide: steps(
          'Очистіть яблуко від шкірки та серцевини.',
          'Наріжте шматочками і додайте трохи води.',
          'Готуйте на парі або відваріть 10–15 хвилин до м’якості.',
          'Подрібніть блендером до пюре. Сире тертя залиште на пізніше.',
          'Почніть з 1–2 чайних ложок.',
        ),
      },
      {
        id: 'food-pear',
        name: 'Груша',
        allowedFromAgeMonths: 6,
        isAllergen: false,
        sortOrder: 2,
        preparationGuide: steps(
          'Очистіть грушу від шкірки та серцевини.',
          'Наріжте шматочками і додайте трохи води.',
          'Готуйте на парі або відваріть 10–15 хвилин до м’якості.',
          'Подрібніть блендером до пюре. Почніть з 1–2 чайних ложок.',
        ),
      },
      {
        id: 'food-banana',
        name: 'Банан',
        allowedFromAgeMonths: 6,
        isAllergen: false,
        sortOrder: 3,
        preparationGuide: steps(
          'Розімніть стиглий банан виделкою, без добавок.',
          'Почніть з 1–2 чайних ложок.',
        ),
      },
      {
        id: 'food-avocado',
        name: 'Авокадо',
        allowedFromAgeMonths: 6,
        isAllergen: false,
        sortOrder: 4,
        preparationGuide: steps(
          'Візьміть стиглий авокадо.',
          'Очистіть від шкірки та вийміть кісточку.',
          'Розімніть виделкою або збийте блендером до однорідності.',
          'За потреби додайте трохи води або грудного молока. Почніть з 1–2 чайних ложок.',
        ),
      },
      {
        id: 'food-prune',
        name: 'Чорнослив',
        allowedFromAgeMonths: 7,
        isAllergen: false,
        sortOrder: 5,
        preparationGuide: steps(
          'Запарьте чорнослив без цукру, зніміть шкірку й розімніть.',
          'Почніть з 1–2 чайних ложок.',
        ),
      },
      {
        id: 'food-peach',
        name: 'Персик',
        allowedFromAgeMonths: 8,
        isAllergen: true,
        sortOrder: 6,
        preparationGuide:
          'Ошпарьте, зніміть шкірку й розімніть стиглу м’якоть. Кісточкові вводьте окремо.',
      },
    ],
  },
  {
    id: 'cat-meat',
    name: 'М’ясо',
    sortOrder: 4,
    items: [
      {
        id: 'food-turkey',
        name: 'Індичка',
        allowedFromAgeMonths: 6,
        isAllergen: false,
        sortOrder: 1,
        preparationGuide: steps(
          'Промийте філе і видаліть плівки.',
          'Відваріть до м’якості.',
          'Подрібніть блендером зі знайомим овочевим пюре.',
          'Почніть з 1–2 чайних ложок.',
        ),
      },
      {
        id: 'food-rabbit',
        name: 'Кролик',
        allowedFromAgeMonths: 6,
        isAllergen: false,
        sortOrder: 2,
        preparationGuide: steps(
          'Промийте пісне м’ясо і видаліть плівки.',
          'Відваріть до м’якості.',
          'Подрібніть і дайте в обід разом зі знайомим овочем.',
          'Почніть з 1–2 чайних ложок.',
        ),
      },
      {
        id: 'food-beef',
        name: 'Яловичина',
        allowedFromAgeMonths: 8,
        isAllergen: false,
        sortOrder: 3,
        preparationGuide: steps(
          'Промийте м’ясо, видаліть плівки та жир.',
          'Повністю проваріть, приблизно 1,5–2 години. Не смажте.',
          'Подрібніть блендером із невеликою кількістю води до гладкої консистенції.',
          'Почніть з 1–2 чайних ложок. Це джерело заліза.',
        ),
      },
      {
        id: 'food-chicken',
        name: 'Курка',
        allowedFromAgeMonths: 8,
        isAllergen: true,
        sortOrder: 4,
        preparationGuide: steps(
          'Промийте м’ясо, видаліть жир і плівки. Шкіру не використовуйте.',
          'Відваріть до повної готовності, приблизно 30 хвилин.',
          'Подрібніть блендером з водою або знайомим овочевим пюре.',
          'Легко засвоюється, але це алерген: вводьте окремо. Почніть з 1–2 чайних ложок.',
        ),
      },
    ],
  },
  {
    id: 'cat-egg',
    name: 'Яйце',
    sortOrder: 5,
    items: [
      {
        id: 'food-yolk',
        name: 'Жовток',
        allowedFromAgeMonths: 7,
        isAllergen: true,
        sortOrder: 1,
        preparationGuide:
          'Зваріть яйце круто й розітріть чверть жовтка зі знайомим пюре. Білок поки не давайте.',
      },
      {
        id: 'food-egg-white',
        name: 'Яєчний білок',
        allowedFromAgeMonths: 12,
        isAllergen: true,
        sortOrder: 2,
        preparationGuide:
          'Зваріть яйце круто й додайте трохи білка до знайомої страви. Сирі яйця не використовуйте.',
      },
    ],
  },
  {
    id: 'cat-fish',
    name: 'Риба',
    sortOrder: 6,
    items: [
      {
        id: 'food-white-fish',
        name: 'Біла риба',
        allowedFromAgeMonths: 8,
        isAllergen: true,
        sortOrder: 1,
        preparationGuide:
          'Відваріть хек або тріску, вийміть усі кістки й розімніть. Вводьте в обід.',
      },
      {
        id: 'food-salmon',
        name: 'Лосось',
        allowedFromAgeMonths: 10,
        isAllergen: true,
        sortOrder: 2,
        preparationGuide:
          'Відваріть невеликий шматок без шкіри, перевірте на кістки й розімніть. Не соліть і не коптіть.',
      },
    ],
  },
  {
    id: 'cat-dairy',
    name: 'Молочні продукти',
    sortOrder: 7,
    items: [
      {
        id: 'food-cottage',
        name: 'Сир кисломолочний',
        allowedFromAgeMonths: 8,
        isAllergen: true,
        sortOrder: 1,
        preparationGuide:
          'Дайте дитячий сир без цукру й добавок або розітріть його зі знайомим пюре.',
      },
      {
        id: 'food-yogurt',
        name: 'Йогурт натуральний',
        allowedFromAgeMonths: 8,
        isAllergen: true,
        sortOrder: 2,
        preparationGuide:
          'Оберіть натуральний йогурт без цукру. Кілька ложок, окремо від інших нових продуктів.',
      },
      {
        id: 'food-kefir',
        name: 'Кефір',
        allowedFromAgeMonths: 8,
        isAllergen: true,
        sortOrder: 3,
        preparationGuide:
          'Дайте несолодкий дитячий кефір. Почніть з кількох ковтків.',
      },
    ],
  },
];
