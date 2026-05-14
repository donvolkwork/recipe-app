import { useState, useCallback, useRef, useEffect } from "react";

const WORKER_URL = "https://recipe-backend-production-416c.up.railway.app/api/recipes";
const FEEDBACK_URL = "https://recipe-backend-production-416c.up.railway.app/api/feedback";

const APP_LINK = "https://t.me/appetiteai_bot";

const FAVORITES_KEY = "favorites";
const FAVORITES_LIMIT = 100;
const LANG_KEY = "userLang";

const SLAVIC_LANGS = ['ru', 'uk', 'be', 'kk', 'uz', 'ky', 'tg', 'tk'];

// FIX P7-#2: АГРЕССИВНЫЙ multi-fallback шер для Xiaomi MIUI WebView
// Последовательно пробуем 6 методов; первый который сработает — выходит через return
// На iOS первый же tg.openTelegramLink перехватит и дальше не пойдёт
async function shareUniversal(text, urlForTelegram, onToast) {
  const tg = window.Telegram?.WebApp;
  const platform = tg?.platform;
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(urlForTelegram)}&text=${encodeURIComponent(text)}`;

  // === Уровень 1: tg.openTelegramLink (iOS, Telegram Desktop) ===
  if (tg && typeof tg.openTelegramLink === "function") {
    try {
      tg.openTelegramLink(shareUrl);
      return;
    } catch { /* падаем дальше */ }
  }

  // === Уровень 1.3: tg.openLink (НОВОЕ - другой метод Telegram SDK) ===
  // Иногда работает на MIUI где openTelegramLink падает
  if (platform === 'android' && tg && typeof tg.openLink === "function") {
    try {
      tg.openLink(shareUrl, { try_instant_view: false });
      return;
    } catch { /* падаем дальше */ }
  }

  // === Уровень 1.5: window.open для Android ===
  if (platform === 'android') {
    try {
      const win = window.open(shareUrl, '_blank');
      if (win) return;
      // если window.open вернул null — браузер заблокировал, идём дальше
    } catch { /* падаем дальше */ }
  }

  // === Уровень 1.7: НОВОЕ - программный клик по невидимой ссылке (Android) ===
  // Обход блокировки window.open в WebView через нативный <a> элемент
  if (platform === 'android') {
    try {
      const a = document.createElement('a');
      a.href = shareUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    } catch { /* падаем дальше */ }
  }

  // === Уровень 1.9: НОВОЕ - прямая навигация (последняя попытка на Android) ===
  // Грубо, но работает в большинстве WebView потому что это базовое поведение
  if (platform === 'android') {
    try {
      window.location.href = shareUrl;
      return;
    } catch { /* падаем дальше */ }
  }

  // === Уровень 2: Web Share API (обычный браузер) ===
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch (e) {
      if (e?.name === "AbortError") return;
    }
  }

  // === Уровень 3: копирование + тост ===
  try {
    await navigator.clipboard.writeText(text);
    if (onToast) onToast();
  } catch { /* */ }
}

// ─── DATA / Локализация ──────────────────────────────────────────────────────
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
    btn: "🔍 Что приготовить?",
    loading: "Придумываю рецепты",
    loadingMore: "Ищу ещё",
    clearAll: "очистить всё",
    selected: "выбрано",
    results: "Варианты блюд",
    back: "← К фильтрам",
    toMyRecipes: "К моим рецептам →",
    showMore: "🔍 Придумать ещё",
    kcal: "ккал",
    kcalPer: "ккал/порция",
    diff: { easy: "Легко", medium: "Средне", hard: "Сложно" },
    howto: "Как готовить",
    ingredientsLabel: "Ингредиенты",
    macrosLabel: "БЖУ на 100г",
    protein: "Белки",
    fat: "Жиры",
    carbs: "Углеводы",
    share: "Поделиться",
    shopList: "📋 Список покупок",
    orProducts: "или выберите продукты",
    calories: "Калории на порцию",
    cookTime: "Время готовки",
    difficulty: "Сложность",
    diet: "Диета",
    filters: "Фильтры",
    dietItems: ["🥗 Вегетарианское","🌾 Без глютена","☦️ Пост","🥑 Кето","🥣 Для ЖКТ","🔥 Для похудения"],
    timeChips: ["До 20 мин","До 40 мин","До 60 мин","Любое"],
    diffChips: ["Легко","Средне","Сложно","Любая"],
    calAny: "Любые",
    noResults: "Рецепт не найден",
    noResultsDesc: "С такой комбинацией фильтров рецептов нет. Попробуй расширить диапазон калорий, изменить сложность или убрать диетические ограничения.",
    changeParams: "← Изменить параметры",
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
    favoritesBackBtn: "← Назад",
    favoritesLimitMsg: "Достигнут лимит 100 рецептов. Удали старые из Избранного",
    addedToFavorites: "Добавлено в избранное ⭐",
    removedFromFavorites: "Удалено из избранного",
    // FIX P7-#1: упрощённый CTA шера без подбора продуктов
    viralCTA: "👇 Попробуй сам:",
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
    btn: "🔍 What can I cook?",
    loading: "Finding recipes",
    loadingMore: "Finding more",
    clearAll: "clear all",
    selected: "selected",
    results: "Recipe ideas",
    back: "← To filters",
    toMyRecipes: "To my recipes →",
    showMore: "🔍 Create more",
    kcal: "kcal",
    kcalPer: "kcal/serving",
    diff: { easy: "Easy", medium: "Medium", hard: "Hard" },
    howto: "How to cook",
    ingredientsLabel: "Ingredients",
    macrosLabel: "Macros per 100g",
    protein: "Protein",
    fat: "Fat",
    carbs: "Carbs",
    share: "Share",
    shopList: "📋 Shopping list",
    orProducts: "or pick ingredients",
    calories: "Calories per serving",
    cookTime: "Cooking time",
    difficulty: "Difficulty",
    diet: "Diet",
    filters: "Filters",
    dietItems: ["🥗 Vegetarian","🌾 Gluten-free","☦️ Fasting","🥑 Keto","🥣 Digestive","🔥 Weight loss"],
    timeChips: ["Under 20 min","Under 40 min","Under 60 min","Any"],
    diffChips: ["Easy","Medium","Hard","Any"],
    calAny: "Any",
    noResults: "No recipes found",
    noResultsDesc: "No recipes match your filters. Try widening the calorie range, changing difficulty, or removing diet restrictions.",
    changeParams: "← Change parameters",
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
    favoritesBackBtn: "← Back",
    favoritesLimitMsg: "Limit of 100 recipes reached. Remove old ones from Favorites",
    addedToFavorites: "Added to favorites ⭐",
    removedFromFavorites: "Removed from favorites",
    viralCTA: "👇 Try yourself:",
  },
};

// FIX P7-#1: упрощённый текст рецепта — простая ссылка без slug-кодирования
function buildRecipeText(r, t) {
  let txt = `${r.emoji} ${r.name}\n`;
  txt += `⏱ ${r.time} • ${t.diff[r.difficulty] || r.difficulty}`;
  if (r.calories) txt += ` • ~${r.calories} ${t.kcalPer}`;
  txt += `\n\n🛒 ${t.ingredientsLabel}:\n${r.ingredients.join('\n')}`;
  if (r.protein != null && r.fat != null && r.carbs != null) {
    txt += `\n\n${t.macrosLabel}: ${t.protein} ${r.protein}г • ${t.fat} ${r.fat}г • ${t.carbs} ${r.carbs}г`;
  }
  txt += `\n\n👨‍🍳 ${t.howto}:\n${r.steps.map((s, i) => `${i+1}. ${s}`).join('\n')}`;
  txt += `\n\n${t.viralCTA}\n${APP_LINK}`;
  return txt;
}

function recipeId(r) {
  if (!r) return "";
  const ing = (r.ingredients || []).slice(0, 3).join("|");
  return `${r.name}::${ing}`;
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

function PanLogo({ onClick }) {
  return (
    <div onClick={onClick} style={{
      width: 44, height: 44, borderRadius: 12, background: "#ea580c",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0, cursor: onClick ? "pointer" : "default",
    }}>
      <svg width="30" height="30" viewBox="0 0 36 36" fill="none">
        <circle cx="16" cy="18" r="11" stroke="white" strokeWidth="3"/>
        <line x1="27" y1="18" x2="35" y2="18" stroke="white" strokeWidth="3" strokeLinecap="round"/>
        <circle cx="12" cy="14" r="2.5" fill="white"/>
        <circle cx="19" cy="21" r="2" fill="white" opacity="0.8"/>
        <circle cx="12" cy="22" r="1.5" fill="white" opacity="0.6"/>
      </svg>
    </div>
  );
}

function ShareSVG({ color = "#64748b" }) {
  return (
    <svg width="14" height="14" viewBox="0 0 12 12" fill="none"
      stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="2" r="1.3"/>
      <circle cx="10" cy="10" r="1.3"/>
      <circle cx="2" cy="6" r="1.3"/>
      <line x1="3.2" y1="5.4" x2="8.8" y2="2.6"/>
      <line x1="3.2" y1="6.6" x2="8.8" y2="9.4"/>
    </svg>
  );
}

function ChatSVG() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
      stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 1C3.7 1 1 3.4 1 6.4c0 1.5.6 2.8 1.7 3.8L2 13l2.9-1.3C5.5 11.9 6.2 12 7 12c3.3 0 6-2.4 6-5.5S10.3 1 7 1z"/>
    </svg>
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

function Toast({ message, visible }) {
  if (!visible) return null;
  return (
    <div style={{
      position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
      background: "rgba(22,163,74,0.95)", color: "#fff",
      padding: "10px 20px", borderRadius: 12,
      fontSize: 13, fontWeight: 500, zIndex: 200,
      boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
      maxWidth: "calc(100% - 32px)", textAlign: "center",
    }}>{message}</div>
  );
}

function FeedbackButton({ t }) {
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
        padding: "12px 16px", cursor: "pointer", marginTop: 8,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
      }}>
        <ChatSVG/>
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

function SmartField({ placeholder, value, onChange, onConfirm, confirmed, onClear, showClearWhenTyping }) {
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
      background: confirmed ? "rgba(234,88,12,0.08)" : "rgba(255,255,255,0.06)",
      border: confirmed ? "1px solid rgba(234,88,12,0.45)" : "1px solid rgba(255,255,255,0.1)",
      borderRadius: 12, padding: "10px 12px",
      display: "flex", alignItems: "center", gap: 8,
      marginBottom: 12, boxSizing: "border-box",
      overflow: "hidden", minWidth: 0,
    }}>
      {confirmed && <span style={{ color: "#fb923c", fontSize: 14, flexShrink: 0 }}>✓</span>}
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
          очистить
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
      borderRadius: 2, margin: "10px 0 8px", opacity: disabled ? 0.4 : 1, cursor: "pointer" }}>
      <div style={{ position: "absolute", height: 4,
        background: disabled ? "rgba(255,255,255,0.1)" : "rgba(234,88,12,0.5)",
        borderRadius: 2, left: `${minPct}%`, right: `${100 - maxPct}%` }}/>
      {["min","max"].map(thumb => (
        <div key={thumb}
          onMouseDown={e => startDrag(thumb, e)}
          onTouchStart={e => startDrag(thumb, e)}
          style={{ position: "absolute", top: -8,
            left: `calc(${thumb === "min" ? minPct : maxPct}% - 10px)`,
            width: 20, height: 20,
            background: disabled ? "#64748b" : "#fb923c", borderRadius: "50%",
            boxShadow: disabled ? "none" : "0 0 6px rgba(234,88,12,0.7)",
            cursor: "grab", touchAction: "none", zIndex: 2 }}/>
      ))}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [lang, setLang] = useState(() => {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved === "ru" || saved === "en") return saved;
    } catch { /* */ }
    const tgLang = window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
    if (tgLang === "en") return "en";
    if (tgLang && SLAVIC_LANGS.includes(tgLang)) return "ru";
    if (tgLang) return "en";
    return "ru";
  });

  const [toast, setToast] = useState(null);
  const [user] = useState(() => ({ isPremium: true }));

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

  const [filtersOpen, setFiltersOpen] = useState(true);
  const [calMin, setCalMin] = useState(100);
  const [calMax, setCalMax] = useState(500);
  const [calAny, setCalAny] = useState(true);
  const [timeIdx, setTimeIdx] = useState(3);
  const [diffIdx, setDiffIdx] = useState(3);
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
      // FIX P7-#1: убран парсинг p_<slugs> — viral deep link удалён
      // Реферальные ссылки оставлены для будущей системы рефералов
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

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
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
        showToast(t.addedToFavorites);
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
  const handleSlider = (newMin, newMax) => { setCalMin(newMin); setCalMax(newMax); setCalAny(false); };

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

  const handleLangSwitch = () => {
    setLang(prevLang => {
      const newLang = prevLang === "ru" ? "en" : "ru";
      try { localStorage.setItem(LANG_KEY, newLang); } catch { /* */ }
      return newLang;
    });
    setRecipes(null); setNoResults(false); setApiError(false); setOpenSet(new Set()); setWarning(null);
    setResultsDiets([]); setView(null);
  };

  const langRef = useRef(lang);
  langRef.current = lang;

  const buildBody = useCallback((excludeList) => ({
    ingredients: [...selected],
    dish: (dishConfirmed && dish.trim()) ? dish.trim() : "",
    exclude: excludeList,
    language: langRef.current,
    calories: { min: calAny ? 0 : calMin, max: calAny ? 99999 : calMax },
    time: DATA[langRef.current].timeChips[timeIdx],
    difficulty: DATA[langRef.current].diffChips[diffIdx],
    diet: [...activeDiets],
  }), [selected, dish, dishConfirmed, calAny, calMin, calMax, timeIdx, diffIdx, activeDiets]);

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
  }, [dish, dishConfirmed, selected, calMin, calMax, calAny, timeIdx, diffIdx, activeDiets, lang, buildBody]);

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

  // FIX P7-#1: упрощённый шер — всегда чистая ссылка на бота
  const handleShare = async (r) => {
    const text = buildRecipeText(r, t);
    await shareUniversal(text, APP_LINK, () => showToast(t.copiedShareMsg));
  };

  const handleShopList = (r, idx) => {
    let txt = `🛒 ${r.name}\n\n`;
    txt += `${t.ingredientsLabel}:\n${r.ingredients.join('\n')}`;
    navigator.clipboard.writeText(txt);
    setCopiedIdx(idx); setTimeout(() => setCopiedIdx(null), 2000);
  };

  const handleRefShare = async () => {
    const refLink = tgUserId ? `${APP_LINK}?startapp=ref_${tgUserId}` : APP_LINK;
    const text = `${t.refShareText}\n\n${refLink}`;
    await shareUniversal(text, refLink, () => showToast(t.copiedShareMsg));
  };

  const handleHeaderShare = async () => {
    const text = `${t.title} — ${t.subtitle}\n\n${APP_LINK}`;
    await shareUniversal(text, APP_LINK, () => showToast(t.copiedShareMsg));
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
  const sDiv = { height: 1, background: "rgba(255,255,255,0.05)", margin: "12px 0" };
  const sFilterBlock = { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "12px 14px" };
  const sChip = active => ({
    background: active ? "rgba(234,88,12,0.12)" : "rgba(255,255,255,0.04)",
    border: active ? "1px solid rgba(234,88,12,0.4)" : "1px solid rgba(255,255,255,0.07)",
    borderRadius: 8, color: active ? "#fb923c" : "#64748b",
    fontSize: 14, padding: "6px 12px", cursor: "pointer",
  });

  const renderRecipeCard = (r, i, openState, toggleHandler) => {
    const isOpen = openState.has(i);
    const fav = isFavorite(r);
    return (
      <div key={i} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16, marginBottom: 12, overflow: "hidden" }}>
        <div onClick={() => toggleHandler(i)}
          style={{ display: "flex", alignItems: "center", gap: 12, padding: "15px 16px", cursor: "pointer" }}>
          <span style={{ fontSize: 30, flexShrink: 0 }}>{r.emoji}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#f1f5f9", marginBottom: 6, textAlign: "left" }}>{r.name}</div>
            <div style={{ fontSize: 13, color: "#64748b", textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              ⏱ {r.time}
              <span style={{ color: "#4ade80", marginLeft: 8 }}>● {t.diff[r.difficulty] || r.difficulty}</span>
              {r.calories && <span style={{ color: "#fb923c", marginLeft: 8 }}>● ~{r.calories} {t.kcalPer}</span>}
            </div>
          </div>
          <button
            onClick={(e) => toggleFavorite(r, e)}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              background: "none", border: "none", padding: 4, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}
            aria-label={fav ? "Remove from favorites" : "Add to favorites"}
          >
            <StarIcon filled={fav} size={20}/>
          </button>
          <span style={{ color: "#64748b", fontSize: 12, flexShrink: 0, marginLeft: 4 }}>{isOpen ? "▲" : "▼"}</span>
        </div>
        {isOpen && (
          <div style={{ padding: "14px 16px 16px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
              {r.ingredients.map((ing, j) => (
                <span key={j} style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)",
                  borderRadius: 8, color: "#6ee7b7", fontSize: 13, padding: "4px 10px" }}>{ing}</span>
              ))}
            </div>

            {(r.protein != null && r.fat != null && r.carbs != null) && (
              <>
                <div style={{ fontSize: 11, color: "#64748b", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
                  {t.macrosLabel}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                  <span style={{
                    background: "rgba(16,185,129,0.1)",
                    border: "1px solid rgba(16,185,129,0.25)",
                    borderRadius: 8, color: "#6ee7b7",
                    fontSize: 13, padding: "4px 10px",
                  }}>🥩 {t.protein} {r.protein}г</span>
                  <span style={{
                    background: "rgba(234,88,12,0.12)",
                    border: "1px solid rgba(234,88,12,0.3)",
                    borderRadius: 8, color: "#fb923c",
                    fontSize: 13, padding: "4px 10px",
                  }}>🥑 {t.fat} {r.fat}г</span>
                  <span style={{
                    background: "rgba(59,130,246,0.1)",
                    border: "1px solid rgba(59,130,246,0.3)",
                    borderRadius: 8, color: "#93c5fd",
                    fontSize: 13, padding: "4px 10px",
                  }}>🌾 {t.carbs} {r.carbs}г</span>
                </div>
              </>
            )}

            <div style={{ fontSize: 11, color: "#64748b", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>{t.howto}</div>
            {r.steps.map((step, j) => (
              <div key={j} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
                <span style={{ background: "rgba(234,88,12,0.15)", border: "1px solid rgba(234,88,12,0.3)",
                  borderRadius: "50%", color: "#fb923c", fontSize: 12, fontWeight: 700,
                  minWidth: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {j + 1}
                </span>
                <span style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.5, textAlign: "left" }}>{step}</span>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button onClick={() => handleShare(r)}
                style={{ flex: 1, background: "rgba(234,88,12,0.15)", border: "1px solid rgba(234,88,12,0.4)",
                  borderRadius: 10, color: "#fb923c", fontSize: 13, fontWeight: 600, padding: "10px",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <ShareSVG color="#fb923c"/> {t.share}
              </button>
              <button onClick={() => handleShopList(r, i)}
                style={{ flex: 1, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)",
                  borderRadius: 10, color: "#6ee7b7", fontSize: 13, padding: "10px",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                {copiedIdx === i ? "✓ " + t.copiedMsg : t.shopList}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ minHeight: "100vh", width: "100%", background: "#0d0f14",
      display: "flex", justifyContent: "center", alignItems: "flex-start",
      padding: 0, margin: 0, boxSizing: "border-box",
      fontFamily: "system-ui,-apple-system,sans-serif" }}>

      <Toast message={toast} visible={!!toast}/>

      <div style={{
        width: "100%", maxWidth: 480, minHeight: "100vh",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderBottom: "none",
        padding: 22, paddingBottom: 48,
        boxSizing: "border-box",
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
            <button onClick={goToFavorites}
              style={{ background: favorites.length > 0 ? "rgba(251,191,36,0.12)" : "rgba(255,255,255,0.06)",
                border: favorites.length > 0 ? "1px solid rgba(251,191,36,0.35)" : "1px solid rgba(255,255,255,0.09)",
                borderRadius: 9, padding: "6px 10px", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 4, color: "#fbbf24",
                fontSize: 12, fontWeight: 700 }}>
              <StarIcon filled={favorites.length > 0} size={14}/>
              {favorites.length > 0 && <span>{favorites.length}</span>}
            </button>
            <button onClick={handleHeaderShare}
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: 9, color: "#64748b", padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center" }}>
              <ShareSVG/>
            </button>
            <button onClick={handleLangSwitch}
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: 9, color: "#64748b", fontSize: 13, fontWeight: 700, padding: "6px 12px", cursor: "pointer" }}>
              {lang === "ru" ? "EN" : "RU"}
            </button>
          </div>
        </div>

        <div style={sDiv}/>

        {isFavoritesScreen ? (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", letterSpacing: 1,
              textTransform: "uppercase", marginBottom: 14 }}>{t.favoritesTitle}</div>

            {favorites.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 12px" }}>
                <div style={{ fontSize: 44, marginBottom: 14 }}>⭐</div>
                <div style={{ fontSize: 16, fontWeight: 500, color: "#f1f5f9", marginBottom: 10 }}>{t.favoritesEmpty}</div>
                <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6, marginBottom: 18, padding: "0 8px" }}>{t.favoritesEmptyDesc}</div>
                <button onClick={backFromFavorites} style={{
                  background: "rgba(234,88,12,0.12)", border: "1px solid rgba(234,88,12,0.35)",
                  borderRadius: 50, color: "#fb923c", fontSize: 14, fontWeight: 600,
                  padding: "12px 24px", cursor: "pointer" }}>
                  {t.favoritesBackBtn}
                </button>
              </div>
            ) : (
              <>
                {favorites.map((r, i) => renderRecipeCard(r, i, favOpenSet, handleToggleFavRecipe))}
                <button onClick={backFromFavorites}
                  style={{ width: "100%", background: "none", border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 50, color: "#64748b", fontSize: 14, padding: "12px 16px", cursor: "pointer", marginTop: 8 }}>
                  {t.favoritesBackBtn}
                </button>
              </>
            )}

            <FeedbackButton t={t}/>
          </div>

        ) : isResultScreen ? (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", letterSpacing: 1,
              textTransform: "uppercase", marginBottom: 14 }}>{t.results}</div>

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
                <button onClick={backToFilters} style={{ background: "rgba(234,88,12,0.12)", border: "1px solid rgba(234,88,12,0.35)",
                  borderRadius: 50, color: "#fb923c", fontSize: 14, fontWeight: 600, padding: "12px 24px", cursor: "pointer" }}>
                  {t.changeParams}
                </button>
              </div>
            )}

            {apiError && !loading && (
              <div style={{ textAlign: "center", padding: "32px 12px" }}>
                <div style={{ fontSize: 40, marginBottom: 14 }}>⚠️</div>
                <div style={{ fontSize: 17, fontWeight: 500, color: "#f1f5f9", marginBottom: 10 }}>{t.errorTitle}</div>
                <div style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6, marginBottom: 18 }}>{t.errorDesc}</div>
                <button onClick={generate} style={{ background: "#ea580c", border: "none", borderRadius: 50,
                  color: "#fff", fontSize: 14, fontWeight: 600, padding: "12px 24px", cursor: "pointer" }}>
                  {t.retry}
                </button>
              </div>
            )}

            {!loading && recipes && recipes.map((r, i) => renderRecipeCard(r, i, openSet, handleToggleRecipe))}

            {!loading && recipes && (
              <button onClick={showMore} disabled={loadingMore}
                style={{ width: "100%", background: "rgba(234,88,12,0.12)", border: "1px solid rgba(234,88,12,0.35)",
                  borderRadius: 50, color: "#fb923c", fontSize: 15, fontWeight: 600, padding: "14px 16px",
                  cursor: loadingMore ? "wait" : "pointer", display: "flex", alignItems: "center",
                  justifyContent: "center", gap: 6, marginTop: 6, opacity: loadingMore ? 0.7 : 1 }}>
                {loadingMore ? (
                  <>{t.loadingMore}<span style={{ display: "inline-block", marginLeft: 2 }}>
                    <span style={{ animation: "dotPulse 1.4s infinite" }}>.</span>
                    <span style={{ animation: "dotPulse 1.4s infinite 0.2s" }}>.</span>
                    <span style={{ animation: "dotPulse 1.4s infinite 0.4s" }}>.</span>
                  </span></>
                ) : t.showMore}
              </button>
            )}

            {!loading && (recipes || noResults || apiError) && (
              <button onClick={backToFilters}
                style={{ width: "100%", background: "none", border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 50, color: "#64748b", fontSize: 14, padding: "12px 16px", cursor: "pointer", marginTop: 8 }}>
                {t.back}
              </button>
            )}

            <FeedbackButton t={t}/>
          </div>

        ) : (
          <>
            <SmartField placeholder={t.dishPlaceholder} value={dish}
              onChange={handleDishChange} onConfirm={confirmDish}
              confirmed={dishConfirmed} onClear={clearDish} showClearWhenTyping={true}/>

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
                            fontSize: 16, cursor: "pointer", lineHeight: 1, padding: 0, marginLeft: 2 }}>×</button>
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
                  background: activeCat === key ? "rgba(234,88,12,0.13)" : "rgba(255,255,255,0.04)",
                  border: activeCat === key ? "1px solid rgba(234,88,12,0.45)" : "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 12, padding: "9px 4px", cursor: "pointer" }}>
                  <span style={{ fontSize: 20 }}>{icon}</span>
                  <span style={{ fontSize: 10, color: activeCat === key ? "#fb923c" : "#64748b", textAlign: "center", lineHeight: 1.2 }}>{label}</span>
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
                      background: selected.has(item) ? "rgba(234,88,12,0.13)" : "rgba(255,255,255,0.04)",
                      border: selected.has(item) ? "1.5px solid rgba(234,88,12,0.5)" : "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 10, color: selected.has(item) ? "#fed7aa" : "#64748b",
                      fontSize: 15, padding: "8px 14px", cursor: "pointer" }}>
                      {selected.has(item) ? "✓ " : ""}{item}
                    </button>
                  ))}
                </div>
                <SmartField placeholder={t.addProductPlaceholder} value={productInput}
                  onChange={handleProductChange} onConfirm={confirmProduct}
                  confirmed={productConfirmed} onClear={clearProduct} showClearWhenTyping={false}/>
              </>
            )}

            <div style={sDiv}/>

            <button onClick={() => setFiltersOpen(o => !o)} style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12, padding: "13px 16px", cursor: "pointer", marginBottom: filtersOpen ? 12 : 16,
              boxSizing: "border-box" }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: "#94a3b8" }}>{t.filters}</span>
              <span style={{ fontSize: 13, color: "#64748b" }}>{filtersOpen ? "▲" : "▼"}</span>
            </button>

            {filtersOpen && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                <div style={sFilterBlock}>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr auto",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 4
                  }}>
                    <PremiumBadge label={t.premiumBadge}/>
                    <span style={{ fontSize: 13, color: "#64748b", textAlign: "center" }}>
                      {t.calories}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#fb923c", whiteSpace: "nowrap" }}>
                      {calAny ? t.calAny : `${calMin} — ${calMax} ${t.kcal}`}
                    </span>
                  </div>
                  <DualSlider min={100} max={1000} valMin={calMin} valMax={calMax} onChange={handleSlider} disabled={calAny}/>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b", marginBottom: 10 }}>
                    <span>100</span><span>1000</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-start" }}>
                    <button onClick={() => setCalAny(a => !a)} style={sChip(calAny)}>{t.calAny}</button>
                  </div>
                </div>

                <div style={sFilterBlock}>
                  <div style={{ marginBottom: 10, textAlign: "center" }}>
                    <span style={{ fontSize: 13, color: "#64748b" }}>{t.cookTime}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {t.timeChips.map((c, i) => (
                      <button key={c} onClick={() => setTimeIdx(i)} style={sChip(timeIdx === i)}>{c}</button>
                    ))}
                  </div>
                </div>

                <div style={sFilterBlock}>
                  <div style={{ marginBottom: 10, textAlign: "center" }}>
                    <span style={{ fontSize: 13, color: "#64748b" }}>{t.difficulty}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {t.diffChips.map((c, i) => (
                      <button key={c} onClick={() => setDiffIdx(i)} style={sChip(diffIdx === i)}>{c}</button>
                    ))}
                  </div>
                </div>

                <div style={sFilterBlock}>
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    marginBottom: 10
                  }}>
                    <div style={{ flex: "0 0 auto" }}>
                      <PremiumBadge label={t.premiumBadge}/>
                    </div>
                    <span style={{ flex: 1, fontSize: 13, color: "#64748b", textAlign: "center" }}>{t.diet}</span>
                    <div style={{ flex: "0 0 auto", visibility: "hidden" }}>
                      <PremiumBadge label={t.premiumBadge}/>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {t.dietItems.map(d => (
                      <button key={d} onClick={() => toggleDiet(d)} style={sChip(activeDiets.has(d))}>{d}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <button onClick={generate} disabled={loading || !canGenerate} style={{
              width: "100%", background: (!canGenerate || loading) ? "rgba(234,88,12,0.4)" : "#ea580c",
              border: "none", borderRadius: 50, color: "#fff", fontSize: 16, fontWeight: 700,
              padding: "15px 16px", cursor: (!canGenerate || loading) ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxSizing: "border-box" }}>
              {loading ? (
                <>{t.loading}<span style={{ display: "inline-block", marginLeft: 2 }}>
                  <span style={{ animation: "dotPulse 1.4s infinite" }}>.</span>
                  <span style={{ animation: "dotPulse 1.4s infinite 0.2s" }}>.</span>
                  <span style={{ animation: "dotPulse 1.4s infinite 0.4s" }}>.</span>
                </span></>
              ) : t.btn}
            </button>

            {hasStoredRecipes && (
              <button onClick={backToRecipes}
                style={{ width: "100%", background: "rgba(234,88,12,0.12)", border: "1px solid rgba(234,88,12,0.35)",
                  borderRadius: 50, color: "#fb923c", fontSize: 14, fontWeight: 600, padding: "11px 16px",
                  cursor: "pointer", marginTop: 10,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                {t.toMyRecipes}
              </button>
            )}

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
                borderRadius: 50, color: "#fb923c", fontSize: 14, fontWeight: 600, padding: "10px 16px",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>
                {t.refShareBtn}
              </button>
            </div>

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

            <FeedbackButton t={t}/>
          </>
        )}
      </div>
    </div>
  );
}
