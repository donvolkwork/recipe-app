import { useState, useCallback, useRef, useEffect } from "react";

const WORKER_URL = "https://recipe-backend-production-416c.up.railway.app/api/recipes";
const FEEDBACK_URL = "https://recipe-backend-production-416c.up.railway.app/api/feedback";

const APP_LINK = "https://t.me/appetiteai_bot";
const APP_LINK_SHARED = "https://t.me/appetiteai_bot?startapp=shared";

const FAVORITES_KEY = "favorites";
const FAVORITES_LIMIT = 100;
const LANG_KEY = "userLang";
// PATCH 9.1: флаг что юзер сам кликнул на кнопку переключения языка
const LANG_MANUAL_KEY = "userLangManual";

// PATCH 10.1: палитра
// Фон — холодный синеватый. Блоки/карточки — непрозрачные (паттерн играет в "воздухе"
// между ними, под глухими блоками не просвечивает — так читаемость лучше).
const BG = "#0c0e15";          // основной фон
const SURFACE = "#16181f";     // непрозрачный фон блоков/карточек/кнопок-контейнеров
const SURFACE_HI = "#1c1f28";  // чуть светлее (поля ввода, активные подложки)
// PATCH 10.1: карточки/блоки чуть светлее для лучшего отделения от фона на паттерне.
const CARD = "#1c1f28";        // блок на фоне (карточки, фильтры, категории, поле, второст. кнопки)
const CARD_HI = "#252834";     // вложенное в блок (чипсы, БЖУ-ячейки, кнопка-звезда, «Список»)

// PATCH 10.1: кулинарный паттерн — повторяющаяся плитка (repeat).
// Мелкие иконки кухни под разными углами, белые с низкой прозрачностью.
// Один data-URI SVG 150×150, тайлится по фону. Быстро, не растягивается.
const PATTERN_SVG = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150"><g fill="none" stroke="#ffffff" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" opacity="0.05"><g transform="translate(22,20) rotate(20)"><circle r="8"/><line x1="8" x2="15"/></g><g transform="translate(70,18) rotate(-30)"><line y1="-11" y2="11"/><path d="M-3,-11 L-3,-4 M0,-11 L0,-4 M3,-11 L3,-4"/></g><g transform="translate(118,24) rotate(40)"><path d="M-8,0 L8,0 L6,15 Q6,18 0,18 Q-6,18 -6,15Z"/></g><g transform="translate(38,58) rotate(-20)"><ellipse rx="5" ry="8"/><line y1="8" y2="16"/></g><g transform="translate(86,54) rotate(50)"><path d="M-7,-4 Q0,-13 7,-4 L5,9 Q5,13 0,13 Q-5,13 -5,9Z"/></g><g transform="translate(128,60) rotate(-40)"><circle r="8"/><line x1="0" y1="-8" x2="0" y2="-13"/></g><g transform="translate(20,96) rotate(35)"><path d="M-8,4 Q-8,-9 0,-9 Q8,-9 8,4Z"/><line x1="-12" y1="4" x2="12" y2="4"/></g><g transform="translate(68,92) rotate(-25)"><rect x="-12" y="-4" width="24" height="6" rx="3"/></g><g transform="translate(112,98) rotate(45)"><path d="M0,-11 Q5,-4 5,3 Q5,9 0,11 Q-5,9 -5,3 Q-5,-4 0,-11Z"/></g><g transform="translate(40,130) rotate(-45)"><line y1="-14" y2="14"/><path d="M-4,-14 Q0,-9 4,-14 Q0,-19 -4,-14"/></g><g transform="translate(90,128) rotate(15)"><circle r="8"/><line x1="0" y1="-8" x2="5" y2="3"/></g><g transform="translate(128,132) rotate(-30)"><path d="M-8,0 L8,0 L6,15 Q6,18 0,18 Q-6,18 -6,15Z"/></g></g></svg>`);
const PATTERN_URL = `url("data:image/svg+xml,${PATTERN_SVG}")`;

// PATCH 10: показывать реф-блок «Пригласи друга». Сейчас false (выключено до запуска
// монетизации). Поставить true когда премиум станет платным.
const SHOW_REFERRAL_BLOCK = false;

const RU_FALLBACK_LANGS = ['be', 'kk', 'uz', 'ky', 'tg', 'tk'];

// PATCH 10: порядок цикла языков теперь RU → EN → UK (английский вторым)
const SUPPORTED_LANGS = ['ru', 'en', 'uk'];

// PATCH 9.1: универсальная функция определения языка
function detectLanguage() {
  const tgLangRaw = window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
  const tgLang = (tgLangRaw || "").toLowerCase();

  if (tgLang.startsWith("uk")) return "uk";
  if (tgLang.startsWith("en")) return "en";
  if (tgLang.startsWith("ru")) return "ru";
  if (tgLang && RU_FALLBACK_LANGS.includes(tgLang)) return "ru";

  const browserLangRaw = navigator.language || (navigator.languages && navigator.languages[0]) || "";
  const browserLang = browserLangRaw.toLowerCase();

  if (browserLang.startsWith("uk")) return "uk";
  if (browserLang.startsWith("ru")) return "ru";
  if (browserLang.startsWith("en")) return "en";

  return "en";
}

async function shareUniversal(text, urlForTelegram, onToast) {
  const tg = window.Telegram?.WebApp;
  const platform = tg?.platform;
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(urlForTelegram)}&text=${encodeURIComponent(text)}`;

  if (tg && typeof tg.openTelegramLink === "function") {
    try {
      tg.openTelegramLink(shareUrl);
      return;
    } catch { /* */ }
  }

  if (platform === 'android' && tg && typeof tg.switchInlineQuery === "function") {
    try {
      tg.switchInlineQuery(text, ['users', 'groups']);
      return;
    } catch { /* */ }
  }

  if (platform === 'android' && tg && typeof tg.openLink === "function") {
    try {
      tg.openLink(shareUrl, { try_instant_view: false });
      return;
    } catch { /* */ }
  }

  if (navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch (e) {
      if (e?.name === "AbortError") return;
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    if (onToast) onToast();
  } catch { /* */ }
}

const DATA = {
  ru: {
    title: "Appetite AI",
    subtitle: "Готовь без поиска",
    dishPlaceholder: "Введите блюдо...",
    cats: {
      meat:     { label: "Мясо",      icon: "🥩" },
      fish:     { label: "Рыба",      icon: "🐟" },
      veggies:  { label: "Овощи",     icon: "🥦" },
      dairy:    { label: "Молочное",  icon: "🧀" },
      grains:   { label: "Крупы",     icon: "🌾" },
      fruits:   { label: "Фрукты",    icon: "🍎" },
      bakery:   { label: "Выпечка",   icon: "🍞" },
      desserts: { label: "Десерты",   icon: "🍰" },
      drinks:   { label: "Напитки",   icon: "🥤" },
      other:    { label: "Прочее",    icon: "🧂" },
    },
    items: {
      meat:     ["Курица","Говядина","Свинина","Фарш","Бекон","Индейка","Утка","Кролик","Ягнёнок","Сосиски"],
      fish:     ["Лосось","Треска","Тунец","Креветки","Сельдь","Минтай","Форель","Кальмар","Мидии","Скумбрия"],
      veggies:  ["Картошка","Лук","Чеснок","Морковь","Помидор","Перец","Баклажан","Кабачок","Капуста","Шпинат","Брокколи","Огурец","Свёкла","Тыква","Сельдерей","Кукуруза"],
      dairy:    ["Яйца","Молоко","Сыр","Сметана","Масло","Творог","Кефир","Сливки","Пармезан","Моцарелла"],
      grains:   ["Рис","Гречка","Паста","Овсянка","Перловка","Булгур","Чечевица","Нут","Манка","Кускус"],
      fruits:   ["Яблоко","Банан","Лимон","Апельсин","Клубника","Черника","Манго","Груша","Виноград","Персик"],
      bakery:   ["Мука","Дрожжи","Слоёное тесто","Лаваш","Батон","Ржаной хлеб","Панировочные сухари","Блинная мука"],
      desserts: ["Шоколад","Какао","Ваниль","Мёд","Сахар","Желатин","Сгущёнка","Карамель","Маршмеллоу"],
      drinks:   ["Молоко","Кефир","Сок апельсиновый","Кокосовое молоко","Зелёный чай","Кофе","Имбирь","Мята"],
      other:    ["Оливковое масло","Соевый соус","Томатная паста","Грибы","Фасоль","Мёд","Горчица","Уксус","Соль","Перец чёрный"],
    },
    addProductPlaceholder: "Добавить продукт...",
    btn: "Что приготовить?",
    loading: "Придумываю рецепты",
    loadingMore: "Придумываю",
    clearAll: "очистить всё",
    selected: "выбрано",
    results: "Варианты блюд",
    back: "К фильтрам",
    toMyRecipes: "К моим рецептам",
    showMore: "Ещё варианты",
    kcal: "ккал",
    kcalPer: "ккал / порция",
    perServing: "/ порция",
    gramShort: "г",
    diff: { easy: "Легко", medium: "Средне", hard: "Сложно" },
    howto: "Как готовить",
    ingredientsLabel: "Ингредиенты",
    macrosLabel: "БЖУ на 100 г",
    protein: "Белки",
    fat: "Жиры",
    carbs: "Углев.",
    share: "Поделиться",
    shopList: "Список",
    orProducts: "или выберите продукты",
    calories: "Калории",
    cookTime: "Время",
    difficulty: "Сложность",
    diet: "Диета",
    filters: "Фильтры",
    dietItems: ["🥗 Вегетарианское","🌾 Без глютена","☦️ Пост","🥑 Кето","🥣 Для ЖКТ","🔥 Для похудения"],
    timeChips: ["До 20","До 40","До 60"], timeUnit: "мин",
    diffChips: ["Легко","Средне","Сложно"],
    calAny: "Любые",
    noResults: "Рецепт не найден",
    noResultsDesc: "С такой комбинацией фильтров рецептов нет. Попробуй расширить диапазон калорий, изменить сложность или убрать диетические ограничения.",
    changeParams: "Изменить параметры",
    errorTitle: "Что-то пошло не так",
    errorDesc: "Не удалось получить рецепты. Попробуй ещё раз через несколько секунд.",
    retry: "Попробовать снова",
    copiedMsg: "Скопировано!",
    copiedShareMsg: "📋 Скопировано — вставь в чат друга",
    catLabel: "Категория",
    prodLabel: "Продукты",
    selectedLabel: "Выбрано",
    warning: "⚠️",
    feedbackBtn: "Обратная связь",
    feedbackTitle: "Напиши нам",
    feedbackHint: "Нашли баг, есть предложение или вопрос — пишите, мы читаем каждое сообщение.",
    feedbackPlaceholder: "Ваше сообщение...",
    feedbackSend: "Отправить",
    feedbackSent: "✓ Отправлено!",
    feedbackCancel: "Отмена",
    premiumBadge: "✨ PREMIUM",
    premiumBannerTitle: "🎁 Premium открыт для всех — тестовая фаза",
    premiumBannerDesc: "Калории, все диеты, избранное — попробуй прямо сейчас!",
    refTitle: "🎁 Пригласи друга — получи Premium",
    refDesc: "1 друг = 7 дней Premium • 5 друзей = месяц • 10 = 3 месяца",
    refShareBtn: "📤 Поделиться ссылкой",
    refStatsLabel: "Приглашено",
    refToNextLabel: "до месяца Premium",
    refShareText: "🍳 Готовлю с Appetite AI — AI-помощник по рецептам в Telegram!\n\nТебе неделя Premium бесплатно при первом запуске 👇",
    favoritesTitle: "Избранное",
    favoritesEmpty: "У тебя пока нет избранных рецептов",
    favoritesEmptyDesc: "Сохрани понравившийся — звёздочка ⭐ в правом верхнем углу карточки",
    favoritesBackBtn: "Назад",
    favoritesLimitMsg: "Достигнут лимит 100 рецептов. Удали старые из Избранного",
    addedToFavorites: "Добавлено в избранное ⭐",
    removedFromFavorites: "Удалено из избранного",
    viralCTA: "👇 Попробуй сам:",
  },
  uk: {
    title: "Appetite AI",
    subtitle: "Готуй без пошуку",
    dishPlaceholder: "Введіть страву...",
    cats: {
      meat:     { label: "М’ясо",     icon: "🥩" },
      fish:     { label: "Риба",      icon: "🐟" },
      veggies:  { label: "Овочі",     icon: "🥦" },
      dairy:    { label: "Молочне",   icon: "🧀" },
      grains:   { label: "Крупи",     icon: "🌾" },
      fruits:   { label: "Фрукти",    icon: "🍎" },
      bakery:   { label: "Випічка",   icon: "🍞" },
      desserts: { label: "Десерти",   icon: "🍰" },
      drinks:   { label: "Напої",     icon: "🥤" },
      other:    { label: "Інше",      icon: "🧂" },
    },
    items: {
      meat:     ["Курка","Яловичина","Свинина","Фарш","Бекон","Індичка","Качка","Кролик","Ягня","Сосиски"],
      fish:     ["Лосось","Тріска","Тунець","Креветки","Оселедець","Мінтай","Форель","Кальмар","Міді","Скумбрія"],
      veggies:  ["Картопля","Цибуля","Часник","Морква","Помідор","Перець","Баклажан","Кабачок","Капуста","Шпинат","Броколі","Огірок","Буряк","Гарбуз","Селера","Кукурудза"],
      dairy:    ["Яйця","Молоко","Сир","Сметана","Масло","Сир кисломолочний","Кефір","Вершки","Пармезан","Моцарела"],
      grains:   ["Рис","Гречка","Паста","Вівсянка","Перловка","Булгур","Сочевиця","Нут","Манка","Кускус"],
      fruits:   ["Яблуко","Банан","Лимон","Апельсин","Полуниця","Чорниця","Манго","Груша","Виноград","Персик"],
      bakery:   ["Борошно","Дріжджі","Листкове тісто","Лаваш","Батон","Житній хліб","Панірувальні сухарі","Млинцеве борошно"],
      desserts: ["Шоколад","Какао","Ваніль","Мед","Цукор","Желатин","Згущене молоко","Карамель","Маршмелоу"],
      drinks:   ["Молоко","Кефір","Апельсиновий сік","Кокосове молоко","Зелений чай","Кава","Імбир","М’ята"],
      other:    ["Оливкова олія","Соєвий соус","Томатна паста","Гриби","Квасоля","Мед","Гірчиця","Оцет","Сіль","Чорний перець"],
    },
    addProductPlaceholder: "Додати продукт...",
    btn: "Що приготувати?",
    loading: "Придумую рецепти",
    loadingMore: "Вигадую",
    clearAll: "очистити все",
    selected: "обрано",
    results: "Варіанти страв",
    back: "До фільтрів",
    toMyRecipes: "До моїх рецептів",
    showMore: "Ще варіанти",
    kcal: "ккал",
    kcalPer: "ккал / порція",
    perServing: "/ порція",
    gramShort: "г",
    diff: { easy: "Легко", medium: "Середньо", hard: "Складно" },
    howto: "Як готувати",
    ingredientsLabel: "Інгредієнти",
    macrosLabel: "БЖВ на 100 г",
    protein: "Білки",
    fat: "Жири",
    carbs: "Вуглев.",
    share: "Поділитися",
    shopList: "Список",
    orProducts: "або оберіть продукти",
    calories: "Калорії",
    cookTime: "Час",
    difficulty: "Складність",
    diet: "Дієта",
    filters: "Фільтри",
    dietItems: ["🥗 Вегетаріанське","🌾 Без глютену","☦️ Піст","🥑 Кето","🥣 Для шлунка","🔥 Для схуднення"],
    timeChips: ["До 20","До 40","До 60"], timeUnit: "хв",
    diffChips: ["Легко","Середньо","Складно"],
    calAny: "Будь-які",
    noResults: "Рецепт не знайдено",
    noResultsDesc: "З такою комбінацією фільтрів рецептів немає. Спробуй розширити діапазон калорій, змінити складність або прибрати дієтичні обмеження.",
    changeParams: "Змінити параметри",
    errorTitle: "Щось пішло не так",
    errorDesc: "Не вдалося отримати рецепти. Спробуй ще раз через кілька секунд.",
    retry: "Спробувати ще раз",
    copiedMsg: "Скопійовано!",
    copiedShareMsg: "📋 Скопійовано — встав у чат другу",
    catLabel: "Категорія",
    prodLabel: "Продукти",
    selectedLabel: "Обрано",
    warning: "⚠️",
    feedbackBtn: "Зворотний зв’язок",
    feedbackTitle: "Напиши нам",
    feedbackHint: "Знайшли баг, є пропозиція або питання — пишіть, ми читаємо кожне повідомлення.",
    feedbackPlaceholder: "Ваше повідомлення...",
    feedbackSend: "Надіслати",
    feedbackSent: "✓ Надіслано!",
    feedbackCancel: "Скасувати",
    premiumBadge: "✨ PREMIUM",
    premiumBannerTitle: "🎁 Premium відкрито для всіх — тестова фаза",
    premiumBannerDesc: "Калорії, всі дієти, обране — спробуй просто зараз!",
    refTitle: "🎁 Запроси друга — отримай Premium",
    refDesc: "1 друг = 7 днів Premium • 5 друзів = місяць • 10 = 3 місяці",
    refShareBtn: "📤 Поділитися посиланням",
    refStatsLabel: "Запрошено",
    refToNextLabel: "до місяця Premium",
    refShareText: "🍳 Готую з Appetite AI — AI-помічник з рецептів у Telegram!\n\nТобі тиждень Premium безкоштовно при першому запуску 👇",
    favoritesTitle: "Обране",
    favoritesEmpty: "У тебе ще немає обраних рецептів",
    favoritesEmptyDesc: "Збережи той що сподобався — зірочка ⭐ у правому верхньому куті картки",
    favoritesBackBtn: "Назад",
    favoritesLimitMsg: "Досягнуто ліміт 100 рецептів. Видали старі з Обраного",
    addedToFavorites: "Додано до обраного ⭐",
    removedFromFavorites: "Видалено з обраного",
    viralCTA: "👇 Спробуй сам:",
  },
  en: {
    title: "Appetite AI",
    subtitle: "Cook without searching",
    dishPlaceholder: "Enter a dish...",
    cats: {
      meat:     { label: "Meat",     icon: "🥩" },
      fish:     { label: "Fish",     icon: "🐟" },
      veggies:  { label: "Veggies",  icon: "🥦" },
      dairy:    { label: "Dairy",    icon: "🧀" },
      grains:   { label: "Grains",   icon: "🌾" },
      fruits:   { label: "Fruits",   icon: "🍎" },
      bakery:   { label: "Bakery",   icon: "🍞" },
      desserts: { label: "Desserts", icon: "🍰" },
      drinks:   { label: "Drinks",   icon: "🥤" },
      other:    { label: "Other",    icon: "🧂" },
    },
    items: {
      meat:     ["Chicken","Beef","Pork","Ground meat","Bacon","Turkey","Duck","Rabbit","Lamb","Sausages"],
      fish:     ["Salmon","Cod","Tuna","Shrimp","Herring","Pollock","Trout","Squid","Mussels","Mackerel"],
      veggies:  ["Potato","Onion","Garlic","Carrot","Tomato","Pepper","Eggplant","Zucchini","Cabbage","Spinach","Broccoli","Cucumber","Beetroot","Pumpkin","Celery","Corn"],
      dairy:    ["Eggs","Milk","Cheese","Sour cream","Butter","Cottage cheese","Kefir","Cream","Parmesan","Mozzarella"],
      grains:   ["Rice","Buckwheat","Pasta","Oatmeal","Barley","Bulgur","Lentils","Chickpeas","Semolina","Couscous"],
      fruits:   ["Apple","Banana","Lemon","Orange","Strawberry","Blueberry","Mango","Pear","Grapes","Peach"],
      bakery:   ["Flour","Yeast","Puff pastry","Pita","Baguette","Rye bread","Breadcrumbs","Pancake mix"],
      desserts: ["Chocolate","Cocoa","Vanilla","Honey","Sugar","Gelatin","Condensed milk","Caramel","Marshmallow"],
      drinks:   ["Milk","Kefir","Orange juice","Coconut milk","Green tea","Coffee","Ginger","Mint"],
      other:    ["Olive oil","Soy sauce","Tomato paste","Mushrooms","Beans","Honey","Mustard","Vinegar","Salt","Black pepper"],
    },
    addProductPlaceholder: "Add ingredient...",
    btn: "What can I cook?",
    loading: "Finding recipes",
    loadingMore: "Thinking",
    clearAll: "clear all",
    selected: "selected",
    results: "Recipe ideas",
    back: "To filters",
    toMyRecipes: "To my recipes",
    showMore: "More options",
    kcal: "kcal",
    kcalPer: "kcal / serving",
    perServing: "/ serving",
    gramShort: "g",
    diff: { easy: "Easy", medium: "Medium", hard: "Hard" },
    howto: "How to cook",
    ingredientsLabel: "Ingredients",
    macrosLabel: "Macros per 100 g",
    protein: "Protein",
    fat: "Fat",
    carbs: "Carbs",
    share: "Share",
    shopList: "List",
    orProducts: "or pick ingredients",
    calories: "Calories",
    cookTime: "Time",
    difficulty: "Difficulty",
    diet: "Diet",
    filters: "Filters",
    dietItems: ["🥗 Vegetarian","🌾 Gluten-free","☦️ Fasting","🥑 Keto","🥣 Digestive","🔥 Weight loss"],
    timeChips: ["Under 20","Under 40","Under 60"], timeUnit: "min",
    diffChips: ["Easy","Medium","Hard"],
    calAny: "Any",
    noResults: "No recipes found",
    noResultsDesc: "No recipes match your filters. Try widening the calorie range, changing difficulty, or removing diet restrictions.",
    changeParams: "Change parameters",
    errorTitle: "Something went wrong",
    errorDesc: "Couldn't get recipes. Please try again in a few seconds.",
    retry: "Try again",
    copiedMsg: "Copied!",
    copiedShareMsg: "📋 Copied — paste it to a friend's chat",
    catLabel: "Category",
    prodLabel: "Products",
    selectedLabel: "Selected",
    warning: "⚠️",
    feedbackBtn: "Feedback",
    feedbackTitle: "Contact us",
    feedbackHint: "Found a bug, have a suggestion or question — write to us, we read every message.",
    feedbackPlaceholder: "Your message...",
    feedbackSend: "Send",
    feedbackSent: "✓ Sent!",
    feedbackCancel: "Cancel",
    premiumBadge: "✨ PREMIUM",
    premiumBannerTitle: "🎁 Premium open for everyone — beta phase",
    premiumBannerDesc: "Calories, all diets, favorites — try it right now!",
    refTitle: "🎁 Invite a friend — get Premium",
    refDesc: "1 friend = 7 days Premium • 5 friends = month • 10 = 3 months",
    refShareBtn: "📤 Share link",
    refStatsLabel: "Invited",
    refToNextLabel: "to month of Premium",
    refShareText: "🍳 Cooking with Appetite AI — your AI recipe assistant in Telegram!\n\nFree week of Premium for you on first launch 👇",
    favoritesTitle: "Favorites",
    favoritesEmpty: "You don't have any saved recipes yet",
    favoritesEmptyDesc: "Save what you like — star ⭐ in the top right corner of the card",
    favoritesBackBtn: "Back",
    favoritesLimitMsg: "Limit of 100 recipes reached. Remove old ones from Favorites",
    addedToFavorites: "Added to favorites ⭐",
    removedFromFavorites: "Removed from favorites",
    viralCTA: "👇 Try yourself:",
  },
};

function buildRecipeText(r, t) {
  const g = t.gramShort;
  let txt = `${r.emoji} ${r.name}\n`;
  txt += `⏱ ${r.time} • ${t.diff[r.difficulty] || r.difficulty}`;
  if (r.calories) txt += ` • ~${r.calories} ${t.kcalPer}`;
  txt += `\n\n🛒 ${t.ingredientsLabel}:\n${r.ingredients.join('\n')}`;
  if (r.protein != null && r.fat != null && r.carbs != null) {
    txt += `\n\n${t.macrosLabel}: ${t.protein} ${r.protein}${g} • ${t.fat} ${r.fat}${g} • ${t.carbs} ${r.carbs}${g}`;
  }
  txt += `\n\n👨‍🍳 ${t.howto}:\n${r.steps.map((s, i) => `${i+1}. ${s}`).join('\n')}`;
  txt += `\n\n${t.viralCTA}\n${APP_LINK_SHARED}`;
  return txt;
}

function recipeId(r) {
  if (!r) return "";
  const ing = (r.ingredients || []).slice(0, 3).join("|");
  return `${r.name}::${ing}`;
}

// ─── PATCH 10: инлайн SVG-иконки (без внешних зависимостей) ──────────────────
function Icon({ name, size = 16, color = "currentColor", style }) {
  const sw = 1.8;
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: color, strokeWidth: sw, strokeLinecap: "round", strokeLinejoin: "round", style };
  switch (name) {
    case "clock":
      return (<svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>);
    case "flame":
      return (<svg {...common}><path d="M12 3c0 4-4 5-4 9a4 4 0 0 0 8 0c0-2-1-3-1-3 0 1.5-1 2-1 2 .5-3-2-5-2-8z"/></svg>);
    case "check":
      return (<svg {...common}><circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/></svg>);
    case "search":
      return (<svg {...common}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>);
    case "plus":
      return (<svg {...common}><path d="M12 5v14M5 12h14"/></svg>);
    case "x":
      return (<svg {...common}><path d="M6 6l12 12M18 6L6 18"/></svg>);
    case "arrow-left":
      return (<svg {...common}><path d="M19 12H5M11 18l-6-6 6-6"/></svg>);
    case "arrow-right":
      return (<svg {...common}><path d="M5 12h14M13 6l6 6-6 6"/></svg>);
    case "chevron-up":
      return (<svg {...common}><path d="M6 15l6-6 6 6"/></svg>);
    case "chevron-down":
      return (<svg {...common}><path d="M6 9l6 6 6-6"/></svg>);
    case "sliders":
      return (<svg {...common}><path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h7M15 18h5"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="13" cy="18" r="2"/></svg>);
    case "chart-bar":
      return (<svg {...common}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>);
    case "leaf":
      return (<svg {...common}><path d="M5 19C5 11 11 5 19 5c0 8-6 14-14 14z"/><path d="M5 19c3-5 6-7 10-9"/></svg>);
    case "basket":
      return (<svg {...common}><path d="M5 9l2-5M19 9l-2-5M3 9h18l-1.5 9.5a2 2 0 0 1-2 1.5H6.5a2 2 0 0 1-2-1.5L3 9z"/></svg>);
    case "pie":
      return (<svg {...common}><path d="M12 3v9l6 6"/><circle cx="12" cy="12" r="9"/></svg>);
    case "list":
      return (<svg {...common}><path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>);
    case "share":
      return (<svg {...common}><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.6M8.2 13.2l7.6 4.6"/></svg>);
    case "checklist":
      return (<svg {...common}><path d="M11 6h9M11 12h9M11 18h9"/><path d="M4 6l1.5 1.5L8 5M4 12l1.5 1.5L8 11M4 18l1.5 1.5L8 17"/></svg>);
    case "sparkles":
      return (<svg {...common}><path d="M12 4l1.5 4.5L18 10l-4.5 1.5L12 16l-1.5-4.5L6 10l4.5-1.5z"/><path d="M18 4v3M19.5 5.5h-3"/></svg>);
    case "chat":
      return (<svg {...common}><path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12z"/></svg>);
    default:
      return null;
  }
}

function CookingLoader({ text }) {
  return (
    <div style={{ textAlign: "center", padding: "32px 12px" }}>
      <style>{`
        @keyframes bubbleRise {
          0%   { transform: translateY(0) scale(0.6); opacity: 0; }
          20%  { opacity: 0.9; }
          70%  { opacity: 0.9; transform: translateY(-22px) scale(1); }
          100% { transform: translateY(-30px) scale(0.4); opacity: 0; }
        }
        @keyframes steamRise {
          0%   { transform: translateY(0) scaleX(1); opacity: 0; }
          30%  { opacity: 0.55; }
          100% { transform: translateY(-26px) scaleX(1.4); opacity: 0; }
        }
        @keyframes flameFlicker {
          0%, 100% { transform: scaleY(1) scaleX(1); opacity: 0.95; }
          50%      { transform: scaleY(0.78) scaleX(1.1); opacity: 0.7; }
        }
        @keyframes dotPulse {
          0%, 60%, 100% { opacity: 0.15; }
          30%           { opacity: 1; }
        }
      `}</style>
      <div style={{ position: "relative", width: 96, height: 96, margin: "0 auto 18px" }}>
        <svg viewBox="0 0 96 96" width="96" height="96" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="38" cy="22" rx="3.5" ry="6" fill="#fb923c"
            style={{ transformOrigin: "38px 28px", animation: "steamRise 2.4s ease-out infinite" }}/>
          <ellipse cx="50" cy="20" rx="3" ry="5" fill="#fb923c"
            style={{ transformOrigin: "50px 26px", animation: "steamRise 2.4s ease-out infinite 0.7s" }}/>
          <ellipse cx="60" cy="22" rx="3.5" ry="5.5" fill="#fb923c"
            style={{ transformOrigin: "60px 28px", animation: "steamRise 2.4s ease-out infinite 1.4s" }}/>
          <path d="M 18 42 L 78 42 L 74 76 Q 74 80 70 80 L 26 80 Q 22 80 22 76 Z"
            fill="#1f2937" stroke="#475569" strokeWidth="2"/>
          <ellipse cx="48" cy="42" rx="30" ry="4" fill="#ea580c" opacity="0.65"/>
          <rect x="12" y="46" width="8" height="4" rx="2" fill="#475569"/>
          <rect x="76" y="46" width="8" height="4" rx="2" fill="#475569"/>
          <circle cx="36" cy="44" r="2.5" fill="#fb923c"
            style={{ transformOrigin: "36px 44px", animation: "bubbleRise 1.6s ease-in-out infinite" }}/>
          <circle cx="48" cy="46" r="2" fill="#fb923c"
            style={{ transformOrigin: "48px 46px", animation: "bubbleRise 1.6s ease-in-out infinite 0.4s" }}/>
          <circle cx="60" cy="44" r="2.3" fill="#fb923c"
            style={{ transformOrigin: "60px 44px", animation: "bubbleRise 1.6s ease-in-out infinite 0.9s" }}/>
          <path d="M 38 86 Q 40 82 44 84 Q 46 80 48 84 Q 50 80 52 84 Q 56 82 58 86 Q 56 90 48 90 Q 40 90 38 86 Z"
            fill="#ea580c"
            style={{ transformOrigin: "48px 88px", animation: "flameFlicker 0.6s ease-in-out infinite" }}/>
          <path d="M 42 88 Q 44 85 46 87 Q 48 84 50 87 Q 52 85 54 88 Q 52 90 48 90 Q 44 90 42 88 Z"
            fill="#fbbf24"
            style={{ transformOrigin: "48px 88px", animation: "flameFlicker 0.4s ease-in-out infinite" }}/>
        </svg>
      </div>
      <div style={{ fontSize: 15, color: "#94a3b8", lineHeight: 1.6 }}>
        {text}
        <span style={{ display: "inline-block", marginLeft: 2 }}>
          <span style={{ animation: "dotPulse 1.4s infinite" }}>.</span>
          <span style={{ animation: "dotPulse 1.4s infinite 0.2s" }}>.</span>
          <span style={{ animation: "dotPulse 1.4s infinite 0.4s" }}>.</span>
        </span>
      </div>
    </div>
  );
}

// PATCH 10.1: лого — пышная шапка повара (вариант C, заливкой). onClick-логика прежняя.
function PanLogo({ onClick }) {
  return (
    <div onClick={onClick} style={{
      width: 44, height: 44, borderRadius: 12, background: "#ea580c",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0, cursor: onClick ? "pointer" : "default",
    }}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
        <path d="M17.5 5.5a3.5 3.5 0 0 0-3-1.95 3.5 3.5 0 0 0-5 0 3.5 3.5 0 0 0-3 1.95A3.5 3.5 0 0 0 5.5 12.4V13a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-.6a3.5 3.5 0 0 0-1-6.9z"/>
        <path d="M7 15.5h10V20a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1z"/>
      </svg>
    </div>
  );
}

function StarIcon({ filled, size = 20 }) {
  if (filled) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#fbbf24" stroke="#fbbf24" strokeWidth="1.5" strokeLinejoin="round">
        <polygon points="12,2 15,9 22,9.5 17,14.5 18.5,21.5 12,18 5.5,21.5 7,14.5 2,9.5 9,9"/>
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.8" strokeLinejoin="round">
      <polygon points="12,2 15,9 22,9.5 17,14.5 18.5,21.5 12,18 5.5,21.5 7,14.5 2,9.5 9,9"/>
    </svg>
  );
}

function PremiumBadge({ label }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 700,
      background: "linear-gradient(135deg, #fbbf24, #ea580c)",
      color: "#fff",
      padding: "2px 7px",
      borderRadius: 10,
      letterSpacing: 0.4,
      boxShadow: "0 0 8px rgba(251,191,36,0.25)",
      verticalAlign: "middle",
      whiteSpace: "nowrap",
      display: "inline-block",
    }}>{label}</span>
  );
}

function Toast({ message, visible, type }) {
  if (!visible) return null;
  const isGold = type === "gold";
  return (
    <div style={{
      position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
      background: isGold ? "linear-gradient(135deg,#f59e0b,#eab308)" : "rgba(22,163,74,0.95)",
      color: isGold ? "#1a1206" : "#fff",
      padding: "11px 22px", borderRadius: 12,
      fontSize: 14, fontWeight: 700, zIndex: 200,
      boxShadow: isGold ? "0 4px 16px rgba(234,179,8,0.3)" : "0 4px 16px rgba(0,0,0,0.4)",
      maxWidth: "calc(100% - 32px)", textAlign: "center",
    }}>{message}</div>
  );
}

function FeedbackButton({ t, pushBottom }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const handleClose = () => { setOpen(false); setText(""); setSent(false); };

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      await fetch(FEEDBACK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });
      setSent(true);
      setTimeout(() => { handleClose(); }, 1500);
    } catch { /* silent */ }
    setSending(false);
  };

  return (
    <>
      <button onClick={() => setOpen(true)} style={{
        width: "100%", background: "none", border: "none",
        color: "#475569", fontSize: 13,
        padding: "12px 16px", cursor: "pointer",
        marginTop: pushBottom ? "auto" : 8,
        paddingTop: pushBottom ? 20 : 12,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
      }}>
        <Icon name="chat" size={14} color="#475569"/>
        {t.feedbackBtn}
      </button>

      {open && (
        <div
          onMouseDown={e => { if (e.target === e.currentTarget) { e.preventDefault(); handleClose(); } }}
          onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
            zIndex: 100, padding: "0 16px 24px",
          }}>
          <div onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 480, background: "#181c23",
              border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: 20,
            }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#f1f5f9", marginBottom: 6 }}>
              {t.feedbackTitle}
            </div>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 14, lineHeight: 1.5 }}>
              {t.feedbackHint}
            </div>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={t.feedbackPlaceholder}
              rows={4}
              style={{
                width: "100%", background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10,
                color: "#f1f5f9", fontSize: 14, padding: "10px 12px",
                resize: "none", outline: "none", boxSizing: "border-box", marginBottom: 12,
                fontFamily: "system-ui, sans-serif",
              }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleClose} style={{
                flex: 1, background: "none", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 10, color: "#64748b", fontSize: 14, padding: "10px", cursor: "pointer" }}>
                {t.feedbackCancel}
              </button>
              <button onClick={send} disabled={!text.trim() || sending} style={{
                flex: 2,
                background: sent ? "rgba(22,163,74,0.2)" : "rgba(234,88,12,0.15)",
                border: sent ? "1px solid rgba(22,163,74,0.4)" : "1px solid rgba(234,88,12,0.4)",
                borderRadius: 10, color: sent ? "#4ade80" : "#fb923c",
                fontSize: 14, fontWeight: 600, padding: "10px", cursor: "pointer" }}>
                {sent ? t.feedbackSent : sending ? "..." : t.feedbackSend}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SmartField({ placeholder, value, onChange, onConfirm, confirmed, onClear, showClearWhenTyping, clearLabel }) {
  const inputRef = useRef(null);
  const hasText = value.trim().length > 0;
  const showClear = confirmed || (showClearWhenTyping && hasText && !confirmed);

  const handleConfirm = () => {
    if (hasText && !confirmed) {
      onConfirm();
      inputRef.current?.blur();
    }
  };

  return (
    <div style={{
      width: "100%",
      background: confirmed ? "rgba(234,88,12,0.10)" : CARD,
      border: confirmed ? "1px solid rgba(234,88,12,0.45)" : "1px solid rgba(255,255,255,0.1)",
      borderRadius: 12, padding: "10px 12px",
      display: "flex", alignItems: "center", gap: 8,
      marginBottom: 12, boxSizing: "border-box",
      overflow: "hidden", minWidth: 0,
    }}>
      {confirmed
        ? <span style={{ color: "#fb923c", fontSize: 14, flexShrink: 0 }}>✓</span>
        : <Icon name="search" size={15} color="#475569" style={{ flexShrink: 0 }}/>}
      <input
        ref={inputRef}
        style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 16,
          color: (hasText || confirmed) ? "#f1f5f9" : "#64748b",
          fontWeight: confirmed ? 500 : 400, minWidth: 0 }}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleConfirm(); } }}
        onBlur={() => { if (hasText && !confirmed) onConfirm(); }}
      />
      {showClear && onClear && (
        <button onMouseDown={e => e.preventDefault()} onClick={() => { onClear(); inputRef.current?.blur(); }}
          style={{ background: "none", border: "none", color: "#64748b",
            fontSize: 12, cursor: "pointer", flexShrink: 0, padding: "0 2px", whiteSpace: "nowrap" }}>
          {clearLabel || "очистить"}
        </button>
      )}
    </div>
  );
}

function DualSlider({ min, max, valMin, valMax, onChange, disabled }) {
  const trackRef = useRef(null);
  const dragging = useRef(null);
  const getPct = val => ((val - min) / (max - min)) * 100;
  const valFromEvent = e => {
    const rect = trackRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    return Math.round(min + (pct / 100) * (max - min));
  };
  const startDrag = (thumb, e) => {
    e.preventDefault();
    dragging.current = thumb;
    const onMove = ev => {
      const val = valFromEvent(ev);
      if (dragging.current === "min") onChange(Math.min(val, valMax - 50), valMax);
      else onChange(valMin, Math.max(val, valMin + 50));
    };
    const onUp = () => {
      dragging.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
  };
  const minPct = getPct(valMin);
  const maxPct = getPct(valMax);
  return (
    <div ref={trackRef} style={{ position: "relative", height: 4, background: "rgba(255,255,255,0.07)",
      borderRadius: 2, margin: "20px 0 18px", opacity: disabled ? 0.4 : 1, cursor: "pointer" }}>
      <div style={{ position: "absolute", height: 4,
        background: disabled ? "rgba(255,255,255,0.1)" : "rgba(234,88,12,0.5)",
        borderRadius: 2, left: `${minPct}%`, right: `${100 - maxPct}%` }}/>
      {["min","max"].map(thumb => (
        <div key={thumb}
          onMouseDown={e => startDrag(thumb, e)}
          onTouchStart={e => startDrag(thumb, e)}
          style={{
            position: "absolute", top: -18,
            left: `calc(${thumb === "min" ? minPct : maxPct}% - 20px)`,
            width: 40, height: 40,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "grab", touchAction: "none", zIndex: 2,
          }}>
          <div style={{
            width: 20, height: 20,
            background: disabled ? "#64748b" : "#fb923c",
            borderRadius: "50%",
            boxShadow: disabled ? "none" : "0 0 6px rgba(234,88,12,0.7)",
          }}/>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [lang, setLang] = useState(() => {
    try {
      const manual = localStorage.getItem(LANG_MANUAL_KEY);
      const saved = localStorage.getItem(LANG_KEY);
      if (manual === "true" && (saved === "ru" || saved === "uk" || saved === "en")) {
        return saved;
      }
    } catch { /* */ }
    return detectLanguage();
  });

  const [toast, setToast] = useState(null);
  const [toastType, setToastType] = useState(null);

  const [referrals] = useState(() => {
    try {
      const saved = localStorage.getItem("referrals");
      if (saved) return JSON.parse(saved);
    } catch { /* */ }
    return { invitedCount: 0, bonusDays: 0 };
  });

  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem(FAVORITES_KEY);
      if (saved) {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr)) return arr;
      }
    } catch { /* */ }
    return [];
  });

  const [tgUserId, setTgUserId] = useState(null);

  const [dish, setDish] = useState("");
  const [dishConfirmed, setDishConfirmed] = useState(false);
  const [activeCat, setActiveCat] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [productInput, setProductInput] = useState("");
  const [productConfirmed, setProductConfirmed] = useState(false);

  // PATCH 10: фильтры свёрнуты по умолчанию
  const [filtersOpen, setFiltersOpen] = useState(false);
  // PATCH 10.1: калории — дефолт полный диапазон (100–1000) = "любые" (кнопки "Любые" больше нет)
  const [calMin, setCalMin] = useState(100);
  const [calMax, setCalMax] = useState(1000);
  // время/сложность — null = не выбрано = подойдёт любое (кнопок "Любое/Любая" больше нет)
  const [timeIdx, setTimeIdx] = useState(null);
  const [diffIdx, setDiffIdx] = useState(null);
  const [activeDiets, setActiveDiets] = useState(new Set());

  const [recipes, setRecipes] = useState(null);
  const [warning, setWarning] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [openSet, setOpenSet] = useState(new Set());
  const [favOpenSet, setFavOpenSet] = useState(new Set());
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [resultsDiets, setResultsDiets] = useState([]);
  const [view, setView] = useState(null);

  useEffect(() => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.expand();
      window.Telegram.WebApp.disableVerticalSwipes?.();

      const startParam = window.Telegram.WebApp.initDataUnsafe?.start_param;
      if (startParam?.startsWith("ref_")) {
        const referrerId = startParam.replace("ref_", "");
        try { localStorage.setItem("referrer", referrerId); } catch { /* */ }
      }

      const myId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
      if (myId) setTgUserId(String(myId));
    }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites)); } catch { /* */ }
  }, [favorites]);

  const t = DATA[lang];
  const g = t.gramShort;

  const clearLabelByLang = lang === 'uk' ? 'очистити' : lang === 'en' ? 'clear' : 'очистить';

  const showToast = (msg, type) => {
    setToast(msg);
    setToastType(type || null);
    setTimeout(() => { setToast(null); setToastType(null); }, 2000);
  };

  const isFavorite = useCallback((r) => {
    const id = recipeId(r);
    return favorites.some(f => recipeId(f) === id);
  }, [favorites]);

  const toggleFavorite = (r, e) => {
    if (e) e.stopPropagation();
    const id = recipeId(r);
    setFavorites(prev => {
      const exists = prev.some(f => recipeId(f) === id);
      if (exists) {
        showToast(t.removedFromFavorites);
        return prev.filter(f => recipeId(f) !== id);
      } else {
        if (prev.length >= FAVORITES_LIMIT) {
          showToast(t.favoritesLimitMsg);
          return prev;
        }
        showToast(t.addedToFavorites, "gold");
        return [...prev, r];
      }
    });
  };

  const confirmDish = () => { if (dish.trim()) setDishConfirmed(true); };
  const clearDish = () => { setDish(""); setDishConfirmed(false); };
  const handleDishChange = v => { setDish(v); setDishConfirmed(false); };

  const confirmProduct = () => {
    const v = productInput.trim();
    if (v) { setSelected(prev => new Set([...prev, v])); setProductInput(""); setProductConfirmed(false); }
  };
  const clearProduct = () => { setProductInput(""); setProductConfirmed(false); };
  const handleProductChange = v => { setProductInput(v); setProductConfirmed(false); };
  const removeProduct = item => {
    setSelected(prev => { const n = new Set(prev); n.delete(item); return n; });
  };

  const handleCatClick = key => setActiveCat(prev => prev === key ? null : key);
  const toggle = item => {
    setSelected(prev => { const n = new Set(prev); n.has(item) ? n.delete(item) : n.add(item); return n; });
  };
  const toggleDiet = d => setActiveDiets(prev => { const n = new Set(prev); n.has(d) ? n.delete(d) : n.add(d); return n; });
  const handleSlider = (newMin, newMax) => { setCalMin(newMin); setCalMax(newMax); };

  const handleToggleRecipe = (i) => {
    setOpenSet(prev => {
      const n = new Set(prev);
      n.has(i) ? n.delete(i) : n.add(i);
      return n;
    });
  };

  const handleToggleFavRecipe = (i) => {
    setFavOpenSet(prev => {
      const n = new Set(prev);
      n.has(i) ? n.delete(i) : n.add(i);
      return n;
    });
  };

  // PATCH 10: цикл RU → EN → UK; при ручном клике пишем флаг
  const handleLangSwitch = () => {
    setLang(prevLang => {
      const idx = SUPPORTED_LANGS.indexOf(prevLang);
      const nextIdx = (idx + 1) % SUPPORTED_LANGS.length;
      const newLang = SUPPORTED_LANGS[nextIdx];
      try {
        localStorage.setItem(LANG_KEY, newLang);
        localStorage.setItem(LANG_MANUAL_KEY, "true");
      } catch { /* */ }
      return newLang;
    });
    setRecipes(null); setNoResults(false); setApiError(false); setOpenSet(new Set()); setWarning(null);
    setResultsDiets([]); setView(null);
  };

  const nextLangLabel = (() => {
    const idx = SUPPORTED_LANGS.indexOf(lang);
    const nextIdx = (idx + 1) % SUPPORTED_LANGS.length;
    return SUPPORTED_LANGS[nextIdx].toUpperCase();
  })();

  const langRef = useRef(lang);
  langRef.current = lang;

  // PATCH 10.1: "любые калории" = полный диапазон (100–1000). time/diff: null → пустая строка (любое).
  const calIsAny = calMin <= 100 && calMax >= 1000;
  const buildBody = useCallback((excludeList) => ({
    ingredients: [...selected],
    dish: (dishConfirmed && dish.trim()) ? dish.trim() : "",
    exclude: excludeList,
    language: langRef.current,
    calories: { min: calIsAny ? 0 : calMin, max: calIsAny ? 99999 : calMax },
    time: timeIdx != null ? DATA[langRef.current].timeChips[timeIdx] : "",
    difficulty: diffIdx != null ? DATA[langRef.current].diffChips[diffIdx] : "",
    diet: [...activeDiets],
  }), [selected, dish, dishConfirmed, calIsAny, calMin, calMax, timeIdx, diffIdx, activeDiets]);

  const generate = useCallback(async () => {
    const hasDish = dishConfirmed && dish.trim();
    const hasIngredients = selected.size > 0;
    const hasDiet = activeDiets.size > 0;
    if (!hasDish && !hasIngredients && !hasDiet) return;
    setApiError(false); setNoResults(false); setWarning(null);
    setLoading(true); setRecipes(null); setOpenSet(new Set());
    setView('results');
    setResultsDiets([...activeDiets]);
    try {
      const res = await fetch(WORKER_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody([])),
        signal: AbortSignal.timeout(30000),
      });
      const text = await res.text();
      const data = JSON.parse(text.replace(/```json|```/g, "").trim());
      if (data.warning) setWarning(data.warning);
      if (!data.recipes || data.recipes.length === 0) {
        setNoResults(true);
      } else {
        setRecipes(data.recipes);
        setOpenSet(new Set());
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch { setApiError(true); }
    setLoading(false);
  }, [dish, dishConfirmed, selected, calMin, calMax, calIsAny, timeIdx, diffIdx, activeDiets, buildBody]);

  const showMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const res = await fetch(WORKER_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(recipes ? recipes.map(r => r.name) : [])),
        signal: AbortSignal.timeout(30000),
      });
      const text = await res.text();
      const data = JSON.parse(text.replace(/```json|```/g, "").trim());
      if (data.recipes && data.recipes.length > 0) setRecipes(prev => [...(prev || []), ...data.recipes]);
    } catch { /* silent */ }
    setLoadingMore(false);
  }, [recipes, buildBody]);

  const handleShare = async (r) => {
    const text = buildRecipeText(r, t);
    await shareUniversal(text, APP_LINK_SHARED, () => showToast(t.copiedShareMsg));
  };

  const handleShopList = (r, idx) => {
    let txt = `🛒 ${r.name}\n\n`;
    txt += `${t.ingredientsLabel}:\n${r.ingredients.join('\n')}`;
    navigator.clipboard.writeText(txt);
    setCopiedIdx(idx); setTimeout(() => setCopiedIdx(null), 2000);
  };

  const handleRefShare = async () => {
    const refLink = tgUserId ? `${APP_LINK}?startapp=ref_${tgUserId}` : APP_LINK_SHARED;
    const text = `${t.refShareText}\n\n${refLink}`;
    await shareUniversal(text, refLink, () => showToast(t.copiedShareMsg));
  };

  const handleHeaderShare = async () => {
    const text = `${t.title} — ${t.subtitle}\n\n${APP_LINK_SHARED}`;
    await shareUniversal(text, APP_LINK_SHARED, () => showToast(t.copiedShareMsg));
  };

  const backToFilters = () => {
    setView(null);
    setApiError(false);
    setNoResults(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const backToRecipes = () => {
    setView('results');
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goToFavorites = () => {
    setFavOpenSet(new Set());
    setView('favorites');
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const backFromFavorites = () => {
    setView(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetAll = () => {
    setRecipes(null); setNoResults(false); setApiError(false);
    setOpenSet(new Set()); setWarning(null); setResultsDiets([]); setView(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const canGenerate = (dishConfirmed && dish.trim()) || selected.size > 0 || activeDiets.size > 0;
  const isResultScreen = view === 'results' && (recipes || noResults || apiError || loading);
  const isFavoritesScreen = view === 'favorites';
  const hasStoredRecipes = view === null && recipes && recipes.length > 0;

  const refTarget = 5;
  const refProgress = Math.min(100, Math.round((referrals.invitedCount / refTarget) * 100));

  const sLabel = { fontSize: 12, fontWeight: 700, color: "#64748b", letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 8 };
  const sDiv = { height: 1, background: "rgba(255,255,255,0.07)", margin: "12px 0" };
  const sFilterBlock = { background: CARD, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "14px 14px" };
  const sChip = active => ({
    background: active ? "rgba(234,88,12,0.15)" : CARD_HI,
    border: active ? "1px solid rgba(234,88,12,0.4)" : "1px solid rgba(255,255,255,0.08)",
    borderRadius: 8, color: active ? "#fb923c" : "#94a3b8",
    fontSize: 14, padding: "6px 12px", cursor: "pointer",
  });
  // PATCH 10: единый стиль секционного заголовка внутри карточки
  const sSectionLabel = { fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: 1, textTransform: "uppercase" };

  // PATCH 10: перекомпонованная карточка рецепта
  const renderRecipeCard = (r, i, openState, toggleHandler) => {
    const isOpen = openState.has(i);
    const fav = isFavorite(r);
    return (
      <div key={i} style={{ background: CARD, border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 16, marginBottom: 12, overflow: "hidden" }}>

        {/* Шапка: эмодзи + название во всю строку + звезда/шеврон справа.
            Идентична в свёрнутом и развёрнутом — не прыгает. */}
        <div onClick={() => toggleHandler(i)}
          style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 14px 11px", cursor: "pointer" }}>
          <span style={{ fontSize: 30, flexShrink: 0, lineHeight: 1 }}>{r.emoji}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 600, color: "#f1f5f9", lineHeight: 1.3, textAlign: "left" }}>{r.name}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
            <button
              onClick={(e) => toggleFavorite(r, e)}
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                width: 30, height: 30, borderRadius: 8,
                background: fav ? "rgba(251,191,36,0.12)" : CARD_HI,
                border: fav ? "1px solid rgba(251,191,36,0.45)" : "1px solid rgba(255,255,255,0.08)",
                boxShadow: fav ? "0 0 8px rgba(251,191,36,0.25)" : "none",
                padding: 0, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
              aria-label={fav ? "Remove from favorites" : "Add to favorites"}
            >
              <StarIcon filled={fav} size={16}/>
            </button>
            <span style={{ color: isOpen ? "#fb923c" : "#64748b", display: "flex", alignItems: "center" }}>
              <Icon name={isOpen ? "chevron-up" : "chevron-down"} size={17} color={isOpen ? "#fb923c" : "#64748b"}/>
            </span>
          </div>
        </div>

        {/* Мета-строка во всю ширину БЕЗ подложки (на фоне карточки), одним серым цветом.
            Одинаково в свёрнутом и развёрнутом, всегда под шапкой. */}
        <div onClick={() => toggleHandler(i)} style={{ display: "flex", justifyContent: "space-around", alignItems: "center",
          padding: "0 12px 13px", cursor: "pointer", flexWrap: "wrap", gap: 6 }}>
          <span style={{ fontSize: 14, color: "#94a3b8", display: "flex", alignItems: "center", gap: 5 }}>
            <Icon name="clock" size={15} color="#94a3b8"/> {r.time}
          </span>
          <span style={{ fontSize: 14, color: "#94a3b8", display: "flex", alignItems: "center", gap: 5 }}>
            <Icon name="check" size={15} color="#94a3b8"/> {t.diff[r.difficulty] || r.difficulty}
          </span>
          {r.calories && (
            <span style={{ fontSize: 14, color: "#94a3b8", display: "flex", alignItems: "center", gap: 5 }}>
              <Icon name="flame" size={15} color="#94a3b8"/> {r.calories} {t.kcal}
              <span style={{ fontSize: 11, color: "#64748b" }}>{t.perServing}</span>
            </span>
          )}
        </div>

        {isOpen && (
          <div style={{ padding: "14px 16px 16px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>

            {/* Ингредиенты списком */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <Icon name="basket" size={14} color="#64748b"/>
              <span style={sSectionLabel}>{t.ingredientsLabel}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", marginBottom: 18 }}>
              {r.ingredients.map((ing, j) => (
                <div key={j} style={{
                  padding: "9px 2px",
                  borderBottom: j < r.ingredients.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                  fontSize: 16, color: "#cbd5e1", textAlign: "left",
                }}>{ing}</div>
              ))}
            </div>

            {/* БЖУ — три ровные ячейки одного цвета */}
            {(r.protein != null && r.fat != null && r.carbs != null) && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  <Icon name="pie" size={14} color="#64748b"/>
                  <span style={sSectionLabel}>{t.macrosLabel}</span>
                </div>
                <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
                  <span style={{ flex: 1, textAlign: "center", background: CARD_HI,
                    border: "1px solid rgba(255,255,255,0.09)", borderRadius: 8, color: "#cbd5e1",
                    fontSize: 14, padding: "7px 4px" }}>{t.protein} <span style={{ color: "#f8fafc", fontWeight: 500 }}>{r.protein} {g}</span></span>
                  <span style={{ flex: 1, textAlign: "center", background: CARD_HI,
                    border: "1px solid rgba(255,255,255,0.09)", borderRadius: 8, color: "#cbd5e1",
                    fontSize: 14, padding: "7px 4px" }}>{t.fat} <span style={{ color: "#f8fafc", fontWeight: 500 }}>{r.fat} {g}</span></span>
                  <span style={{ flex: 1, textAlign: "center", background: CARD_HI,
                    border: "1px solid rgba(255,255,255,0.09)", borderRadius: 8, color: "#cbd5e1",
                    fontSize: 14, padding: "7px 4px" }}>{t.carbs} <span style={{ color: "#f8fafc", fontWeight: 500 }}>{r.carbs} {g}</span></span>
                </div>
              </>
            )}

            {/* Шаги */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
              <Icon name="list" size={14} color="#64748b"/>
              <span style={sSectionLabel}>{t.howto}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 13, marginBottom: 18 }}>
              {r.steps.map((step, j) => (
                <div key={j} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%",
                    background: "rgba(234,88,12,0.15)", border: "1px solid rgba(234,88,12,0.4)",
                    color: "#fb923c", fontSize: 13, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {j + 1}
                  </div>
                  <span style={{ fontSize: 16, color: "#cbd5e1", lineHeight: 1.5, textAlign: "left" }}>{step}</span>
                </div>
              ))}
            </div>

            {/* Кнопки */}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => handleShare(r)}
                style={{ flex: 1, background: "rgba(234,88,12,0.14)", border: "1px solid rgba(234,88,12,0.4)",
                  borderRadius: 12, color: "#fb923c", fontSize: 14, fontWeight: 600, padding: "11px",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Icon name="share" size={15} color="#fb923c"/> {t.share}
              </button>
              <button onClick={() => handleShopList(r, i)}
                style={{ flex: 1, background: CARD_HI, border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12, color: copiedIdx === i ? "#6ee7b7" : "#cbd5e1", fontSize: 14, fontWeight: 600, padding: "11px",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                {copiedIdx === i ? "✓ " + t.copiedMsg : (<><Icon name="checklist" size={15} color="#cbd5e1"/> {t.shopList}</>)}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ minHeight: "100vh", width: "100%",
      background: BG,
      backgroundImage: PATTERN_URL,
      backgroundRepeat: "repeat",
      display: "flex", justifyContent: "center", alignItems: "flex-start",
      padding: 0, margin: 0, boxSizing: "border-box",
      fontFamily: "system-ui,-apple-system,sans-serif" }}>

      <Toast message={toast} visible={!!toast} type={toastType}/>

      <style>{`
        @keyframes starTwinkle {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50%      { opacity: 1;   transform: scale(1.2); }
        }
      `}</style>

      <div style={{
        width: "100%", maxWidth: 480, minHeight: "100vh",
        background: "transparent",
        borderLeft: "1px solid rgba(255,255,255,0.05)",
        borderRight: "1px solid rgba(255,255,255,0.05)",
        padding: 22, paddingBottom: 28,
        boxSizing: "border-box",
        display: "flex", flexDirection: "column",
      }}>


        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <PanLogo onClick={(isResultScreen || hasStoredRecipes || isFavoritesScreen) ? resetAll : undefined}/>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#fff", lineHeight: 1.1 }}>{t.title}</div>
              <div style={{ fontSize: 12, color: "#ea580c", fontWeight: 500, marginTop: 2 }}>{t.subtitle}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {/* PATCH 10: звезда в хедере — горит без счётчика когда есть избранное */}
            <button onClick={goToFavorites}
              style={{ background: favorites.length > 0 ? "rgba(251,191,36,0.12)" : CARD_HI,
                border: favorites.length > 0 ? "1px solid rgba(251,191,36,0.35)" : "1px solid rgba(255,255,255,0.09)",
                borderRadius: 9, padding: "6px 10px", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center" }}>
              <StarIcon filled={favorites.length > 0} size={15}/>
            </button>
            <button onClick={handleHeaderShare}
              style={{ background: CARD_HI, border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: 9, color: "#64748b", padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center" }}>
              <Icon name="share" size={14} color="#64748b"/>
            </button>
            <button onClick={handleLangSwitch}
              style={{ background: CARD_HI, border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: 9, color: "#64748b", fontSize: 13, fontWeight: 700, padding: "6px 12px", cursor: "pointer" }}>
              {nextLangLabel}
            </button>
          </div>
        </div>

        <div style={sDiv}/>

        {isFavoritesScreen ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", letterSpacing: 1,
              textTransform: "uppercase", marginBottom: 14 }}>{t.favoritesTitle}</div>

            {favorites.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 12px" }}>
                <div style={{ fontSize: 44, marginBottom: 14 }}>⭐</div>
                <div style={{ fontSize: 16, fontWeight: 500, color: "#f1f5f9", marginBottom: 10 }}>{t.favoritesEmpty}</div>
                <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6, marginBottom: 18, padding: "0 8px" }}>{t.favoritesEmptyDesc}</div>
                <button onClick={backFromFavorites} style={{
                  background: "rgba(234,88,12,0.12)", border: "1px solid rgba(234,88,12,0.35)",
                  borderRadius: 12, color: "#fb923c", fontSize: 14, fontWeight: 600,
                  padding: "12px 24px", cursor: "pointer",
                  display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Icon name="arrow-left" size={15} color="#fb923c"/> {t.favoritesBackBtn}
                </button>
              </div>
            ) : (
              <>
                {favorites.map((r, i) => renderRecipeCard(r, i, favOpenSet, handleToggleFavRecipe))}
                <button onClick={backFromFavorites}
                  style={{ width: "100%", background: "none", border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 12, color: "#64748b", fontSize: 14, padding: "12px 16px", cursor: "pointer", marginTop: 8,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <Icon name="arrow-left" size={15} color="#64748b"/> {t.favoritesBackBtn}
                </button>
              </>
            )}

            <FeedbackButton t={t} pushBottom/>
          </div>

        ) : isResultScreen ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <button onClick={backToFilters} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center" }}>
                <Icon name="arrow-left" size={18} color="#94a3b8"/>
              </button>
              <span style={{ fontSize: 16, fontWeight: 500, color: "#f8fafc" }}>{t.results}</span>
            </div>

            {resultsDiets.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16, marginTop: -6 }}>
                {resultsDiets.map(d => (
                  <span key={d} style={{
                    background: "rgba(234,88,12,0.13)",
                    border: "1px solid rgba(234,88,12,0.4)",
                    borderRadius: 20,
                    color: "#fb923c",
                    fontSize: 12,
                    fontWeight: 500,
                    padding: "4px 12px",
                    whiteSpace: "nowrap",
                  }}>{d}</span>
                ))}
              </div>
            )}

            {warning && (
              <div style={{ background: "rgba(251,146,60,0.1)", border: "1px solid rgba(251,146,60,0.3)",
                borderRadius: 12, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#fb923c" }}>
                {t.warning} {warning}
              </div>
            )}

            {loading && <CookingLoader text={t.loading}/>}

            {noResults && !loading && (
              <div style={{ textAlign: "center", padding: "32px 12px" }}>
                <div style={{ fontSize: 40, marginBottom: 14 }}>🔍</div>
                <div style={{ fontSize: 17, fontWeight: 500, color: "#f1f5f9", marginBottom: 10 }}>{t.noResults}</div>
                <div style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6, marginBottom: 18 }}>{t.noResultsDesc}</div>
                <button onClick={backToFilters} style={{ width: "100%", background: "#ea580c", border: "none",
                  borderRadius: 12, color: "#fff", fontSize: 15, fontWeight: 700, padding: "14px", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6, boxSizing: "border-box" }}>
                  <Icon name="arrow-left" size={15} color="#fff"/> {t.changeParams}
                </button>
              </div>
            )}

            {apiError && !loading && (
              <div style={{ textAlign: "center", padding: "32px 12px" }}>
                <div style={{ fontSize: 40, marginBottom: 14 }}>⚠️</div>
                <div style={{ fontSize: 17, fontWeight: 500, color: "#f1f5f9", marginBottom: 10 }}>{t.errorTitle}</div>
                <div style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6, marginBottom: 18 }}>{t.errorDesc}</div>
                <button onClick={generate} style={{ width: "100%", background: "#ea580c", border: "none", borderRadius: 12,
                  color: "#fff", fontSize: 15, fontWeight: 700, padding: "14px", cursor: "pointer", boxSizing: "border-box" }}>
                  {t.retry}
                </button>
              </div>
            )}

            {!loading && recipes && recipes.map((r, i) => renderRecipeCard(r, i, openSet, handleToggleRecipe))}

            {!loading && recipes && (
              <button onClick={showMore} disabled={loadingMore}
                style={{ width: "100%", background: "rgba(234,88,12,0.12)", border: "1px solid rgba(234,88,12,0.35)",
                  borderRadius: 12, color: "#fb923c", fontSize: 14, fontWeight: 600, padding: "13px 16px",
                  cursor: loadingMore ? "wait" : "pointer", display: "flex", alignItems: "center",
                  justifyContent: "center", gap: 7, marginTop: 6, opacity: loadingMore ? 0.7 : 1 }}>
                {loadingMore ? (
                  <><span style={{ display: "inline-flex", gap: 3, alignItems: "center", marginRight: 2 }}>
                    <span style={{ fontSize: 13, animation: "starTwinkle 1.2s ease-in-out infinite" }}>✨</span>
                    <span style={{ fontSize: 10, animation: "starTwinkle 1.2s ease-in-out infinite 0.4s" }}>⭐</span>
                    <span style={{ fontSize: 12, animation: "starTwinkle 1.2s ease-in-out infinite 0.8s" }}>✨</span>
                  </span>{t.loadingMore}</>
                ) : (<><Icon name="sparkles" size={15} color="#fb923c"/> {t.showMore}</>)}
              </button>
            )}

            {!loading && (recipes || noResults || apiError) && (
              <button onClick={backToFilters}
                style={{ width: "100%", background: CARD, border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12, color: "#94a3b8", fontSize: 15, fontWeight: 600, padding: "14px", cursor: "pointer", marginTop: 8,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6, boxSizing: "border-box" }}>
                <Icon name="arrow-left" size={15} color="#94a3b8"/> {t.back}
              </button>
            )}

            <FeedbackButton t={t} pushBottom/>
          </div>

        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <SmartField placeholder={t.dishPlaceholder} value={dish}
              onChange={handleDishChange} onConfirm={confirmDish}
              confirmed={dishConfirmed} onClear={clearDish} showClearWhenTyping={true}
              clearLabel={clearLabelByLang}/>

            <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 12px" }}>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }}/>
              <span style={{ fontSize: 12, color: "#64748b" }}>{t.orProducts}</span>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }}/>
            </div>

            {selected.size > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={sLabel}>{t.selectedLabel}: {selected.size}</span>
                  <button onClick={() => { setSelected(new Set()); }}
                    style={{ background: "none", border: "none", color: "#64748b", fontSize: 12, cursor: "pointer" }}>
                    {t.clearAll}
                  </button>
                </div>
                <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", scrollbarWidth: "none", msOverflowStyle: "none" }}>
                  <div style={{ display: "flex", gap: 8, paddingBottom: 4, width: "max-content" }}>
                    {[...selected].map(item => (
                      <div key={item} style={{ display: "flex", alignItems: "center", gap: 6,
                        background: "rgba(234,88,12,0.13)", border: "1px solid rgba(234,88,12,0.4)",
                        borderRadius: 20, color: "#fed7aa", fontSize: 14, padding: "6px 12px",
                        whiteSpace: "nowrap", flexShrink: 0 }}>
                        ✓ {item}
                        <button onClick={() => removeProduct(item)}
                          style={{ background: "none", border: "none", color: "#fb923c",
                            cursor: "pointer", lineHeight: 1, padding: 0, marginLeft: 2, display: "flex", alignItems: "center" }}>
                          <Icon name="x" size={13} color="#fb923c"/>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <span style={sLabel}>{t.catLabel}</span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 7, marginBottom: 12 }}>
              {Object.entries(t.cats).map(([key, { label, icon }]) => (
                <div key={key} onClick={() => handleCatClick(key)} style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                  background: activeCat === key ? "rgba(234,88,12,0.15)" : CARD,
                  border: activeCat === key ? "1px solid rgba(234,88,12,0.45)" : "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 12, padding: "10px 4px", cursor: "pointer" }}>
                  <span style={{ fontSize: 24 }}>{icon}</span>
                  <span style={{ fontSize: 11, color: activeCat === key ? "#fb923c" : "#94a3b8", textAlign: "center", lineHeight: 1.2 }}>{label}</span>
                </div>
              ))}
            </div>

            {activeCat && (
              <>
                <div style={sDiv}/>
                <span style={{ ...sLabel, marginBottom: 10 }}>{t.prodLabel}</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                  {t.items[activeCat].map(item => (
                    <button key={item} onClick={() => toggle(item)} style={{
                      background: selected.has(item) ? "rgba(234,88,12,0.15)" : CARD,
                      border: selected.has(item) ? "1.5px solid rgba(234,88,12,0.5)" : "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 10, color: selected.has(item) ? "#fed7aa" : "#94a3b8",
                      fontSize: 15, padding: "8px 14px", cursor: "pointer" }}>
                      {selected.has(item) ? "✓ " : ""}{item}
                    </button>
                  ))}
                </div>
                <SmartField placeholder={t.addProductPlaceholder} value={productInput}
                  onChange={handleProductChange} onConfirm={confirmProduct}
                  confirmed={productConfirmed} onClear={clearProduct} showClearWhenTyping={false}
                  clearLabel={clearLabelByLang}/>
              </>
            )}

            <div style={sDiv}/>

            {!filtersOpen && (
              <button onClick={() => setFiltersOpen(true)} style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                background: CARD, border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12, padding: "13px 16px", cursor: "pointer", marginBottom: 16,
                boxSizing: "border-box" }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: "#94a3b8", display: "flex", alignItems: "center", gap: 7 }}>
                  <Icon name="sliders" size={15} color="#64748b"/> {t.filters}
                </span>
                <Icon name="chevron-down" size={14} color="#64748b"/>
              </button>
            )}

            {filtersOpen && (
              <div style={{ ...sFilterBlock, marginBottom: 16 }}>

                {/* Шапка блока фильтров: заголовок слева + Premium-бейдж + шеврон (сворачивает) */}
                <div onClick={() => setFiltersOpen(false)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, cursor: "pointer" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#cbd5e1", display: "flex", alignItems: "center", gap: 7 }}>
                    <Icon name="sliders" size={15} color="#fb923c"/> {t.filters}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <PremiumBadge label={t.premiumBadge}/>
                    <Icon name="chevron-up" size={14} color="#fb923c"/>
                  </span>
                </div>

                {/* Калории — без кнопки "Любые": полный диапазон = любые */}
                <div style={{ fontSize: 14, color: "#94a3b8", display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                  <Icon name="flame" size={14} color={calIsAny ? "#64748b" : "#fb923c"}/> {t.calories}
                  <span style={{ color: "#475569", fontSize: 11 }}>{t.perServing}</span>
                  <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 500, color: calIsAny ? "#64748b" : "#fb923c", whiteSpace: "nowrap" }}>
                    {calIsAny ? t.calAny : `${calMin} — ${calMax} ${t.kcal}`}
                  </span>
                </div>
                <DualSlider min={100} max={1000} valMin={calMin} valMax={calMax} onChange={handleSlider} disabled={false}/>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b", marginBottom: 16 }}>
                  <span>100</span><span>1000</span>
                </div>

                {/* Время — 3 чипса, "мин" у заголовка; повторный тап снимает (null = любое) */}
                <div style={{ fontSize: 14, color: "#94a3b8", display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
                  <Icon name="clock" size={14} color="#fb923c"/> {t.cookTime} <span style={{ color: "#475569", fontSize: 11 }}>{t.timeUnit}</span>
                </div>
                <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
                  {t.timeChips.map((c, i) => (
                    <button key={c} onClick={() => setTimeIdx(timeIdx === i ? null : i)} style={{ ...sChip(timeIdx === i), flex: 1, textAlign: "center", padding: "9px 0", fontSize: 14 }}>{c}</button>
                  ))}
                </div>

                {/* Сложность — 3 чипса; повторный тап снимает (null = любая) */}
                <div style={{ fontSize: 14, color: "#94a3b8", display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
                  <Icon name="chart-bar" size={14} color="#fb923c"/> {t.difficulty}
                </div>
                <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
                  {t.diffChips.map((c, i) => (
                    <button key={c} onClick={() => setDiffIdx(diffIdx === i ? null : i)} style={{ ...sChip(diffIdx === i), flex: 1, textAlign: "center", padding: "9px 0", fontSize: 14 }}>{c}</button>
                  ))}
                </div>

                {/* Диета — полные названия, перенос в несколько строк */}
                <div style={{ fontSize: 14, color: "#94a3b8", display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
                  <Icon name="leaf" size={14} color="#fb923c"/> {t.diet}
                </div>
                <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                  {t.dietItems.map(d => (
                    <button key={d} onClick={() => toggleDiet(d)} style={{ ...sChip(activeDiets.has(d)), fontSize: 14, padding: "7px 13px" }}>{d}</button>
                  ))}
                </div>
              </div>
            )}

            <button onClick={generate} disabled={loading || !canGenerate} style={{
              width: "100%", background: (!canGenerate || loading) ? "rgba(234,88,12,0.4)" : "#ea580c",
              border: "none", borderRadius: 12, color: "#fff", fontSize: 16, fontWeight: 700,
              padding: "15px 16px", cursor: (!canGenerate || loading) ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxSizing: "border-box" }}>
              {loading ? (
                <>{t.loading}<span style={{ display: "inline-block", marginLeft: 2 }}>
                  <span style={{ animation: "dotPulse 1.4s infinite" }}>.</span>
                  <span style={{ animation: "dotPulse 1.4s infinite 0.2s" }}>.</span>
                  <span style={{ animation: "dotPulse 1.4s infinite 0.4s" }}>.</span>
                </span></>
              ) : (<><Icon name="search" size={16} color="#fff"/> {t.btn}</>)}
            </button>

            {hasStoredRecipes && (
              <button onClick={backToRecipes}
                style={{ width: "100%", background: "rgba(234,88,12,0.12)", border: "1px solid rgba(234,88,12,0.35)",
                  borderRadius: 12, color: "#fb923c", fontSize: 14, fontWeight: 600, padding: "11px 16px",
                  cursor: "pointer", marginTop: 10,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                {t.toMyRecipes} <Icon name="arrow-right" size={14} color="#fb923c"/>
              </button>
            )}

            {/* PATCH 10: блок «Пригласи друга» скрыт до запуска монетизации (SHOW_REFERRAL_BLOCK) */}
            {SHOW_REFERRAL_BLOCK && (
              <div style={{
                marginTop: 28,
                background: "linear-gradient(135deg, rgba(234,88,12,0.08), rgba(251,191,36,0.05))",
                border: "1px solid rgba(234,88,12,0.3)",
                borderRadius: 14, padding: "16px 18px",
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9", marginBottom: 6 }}>
                  {t.refTitle}
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 14, lineHeight: 1.5 }}>
                  {t.refDesc}
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: "#64748b" }}>
                      {t.refStatsLabel}: <strong style={{ color: "#fb923c" }}>{referrals.invitedCount} / {refTarget}</strong> {t.refToNextLabel}
                    </span>
                    <span style={{ fontSize: 11, color: "#fb923c", fontWeight: 600 }}>{refProgress}%</span>
                  </div>
                  <div style={{
                    height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden",
                  }}>
                    <div style={{
                      width: `${refProgress}%`,
                      height: "100%",
                      background: "linear-gradient(90deg, #ea580c, #fbbf24)",
                      borderRadius: 3,
                      transition: "width 0.4s ease",
                    }}/>
                  </div>
                </div>

                <button onClick={handleRefShare} style={{
                  width: "100%", background: "rgba(234,88,12,0.15)", border: "1px solid rgba(234,88,12,0.45)",
                  borderRadius: 12, color: "#fb923c", fontSize: 14, fontWeight: 600, padding: "10px 16px",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}>
                  {t.refShareBtn}
                </button>
              </div>
            )}

            <div style={{
              marginTop: 14,
              background: "rgba(251,191,36,0.06)",
              border: "1px solid rgba(251,191,36,0.25)",
              borderRadius: 12, padding: "12px 14px",
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#fbbf24", marginBottom: 4 }}>
                {t.premiumBannerTitle}
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>
                {t.premiumBannerDesc}
              </div>
            </div>

            <FeedbackButton t={t} pushBottom/>
          </div>
        )}
      </div>
    </div>
  );
}
