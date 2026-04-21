import { useState, useCallback, useRef } from "react";

const WORKER_URL = "https://recipe-backend-production-416c.up.railway.app/api/recipes";

const DATA = {
  ru: {
    title: "Что приготовить?",
    subtitle: "Выбери блюдо или продукты — найдём рецепт",
    dishPlaceholder: "Введите блюдо...",
    cats: {
      meat:    { label: "Мясо",     icon: "🥩" },
      fish:    { label: "Рыба",     icon: "🐟" },
      veggies: { label: "Овощи",    icon: "🥦" },
      dairy:   { label: "Молочное", icon: "🧀" },
      grains:  { label: "Крупы",    icon: "🌾" },
      other:   { label: "Прочее",   icon: "🧂" },
    },
    items: {
      meat:    ["Курица","Говядина","Свинина","Фарш","Бекон","Индейка","Утка","Кролик"],
      fish:    ["Лосось","Треска","Тунец","Креветки","Сельдь","Минтай","Форель","Кальмар"],
      veggies: ["Картошка","Лук","Чеснок","Морковь","Помидор","Перец","Баклажан","Кабачок","Капуста","Шпинат","Брокколи","Огурец"],
      dairy:   ["Яйца","Молоко","Сыр","Сметана","Масло","Творог","Кефир","Сливки"],
      grains:  ["Рис","Гречка","Паста","Овсянка","Перловка","Булгур","Чечевица","Нут"],
      other:   ["Оливковое масло","Соевый соус","Томатная паста","Грибы","Фасоль","Лимон","Мёд","Горчица"],
    },
    addProductPlaceholder: "Добавить продукт...",
    btn: "🔍 Что приготовить?",
    loading: "Придумываю рецепты...",
    loadingMore: "Ищу ещё...",
    clearAll: "очистить всё",
    selected: "выбрано",
    results: "Варианты блюд",
    back: "← Назад",
    showMore: "🔍 Показать ещё",
    min: "мин", kcal: "ккал",
    diff: { easy:"Легко", medium:"Средне", hard:"Сложно" },
    howto: "Как готовить",
    share: "Поделиться",
    shopList: "📋 Список покупок",
    orProducts: "или выберите продукты",
    calories: "Калории на блюдо",
    cookTime: "Время готовки",
    difficulty: "Сложность",
    diet: "Диета",
    filters: "Фильтры",
    dietItems: ["🥗 Вегетарианское","🌾 Без глютена","☦️ Пост","🥑 Кето","🥣 Для ЖКТ"],
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
    catLabel: "Категория",
    prodLabel: "Продукты",
    selectedLabel: "Выбрано",
  },
  en: {
    title: "What to cook?",
    subtitle: "Enter a dish or pick ingredients — we'll find a recipe",
    dishPlaceholder: "Enter a dish...",
    cats: {
      meat:    { label: "Meat",    icon: "🥩" },
      fish:    { label: "Fish",    icon: "🐟" },
      veggies: { label: "Veggies", icon: "🥦" },
      dairy:   { label: "Dairy",   icon: "🧀" },
      grains:  { label: "Grains",  icon: "🌾" },
      other:   { label: "Other",   icon: "🧂" },
    },
    items: {
      meat:    ["Chicken","Beef","Pork","Ground meat","Bacon","Turkey","Duck","Rabbit"],
      fish:    ["Salmon","Cod","Tuna","Shrimp","Herring","Pollock","Trout","Squid"],
      veggies: ["Potato","Onion","Garlic","Carrot","Tomato","Pepper","Eggplant","Zucchini","Cabbage","Spinach","Broccoli","Cucumber"],
      dairy:   ["Eggs","Milk","Cheese","Sour cream","Butter","Cottage cheese","Kefir","Cream"],
      grains:  ["Rice","Buckwheat","Pasta","Oatmeal","Barley","Bulgur","Lentils","Chickpeas"],
      other:   ["Olive oil","Soy sauce","Tomato paste","Mushrooms","Beans","Lemon","Honey","Mustard"],
    },
    addProductPlaceholder: "Add ingredient...",
    btn: "🔍 What can I cook?",
    loading: "Finding recipes...",
    loadingMore: "Finding more...",
    clearAll: "clear all",
    selected: "selected",
    results: "Recipe ideas",
    back: "← Back",
    showMore: "🔍 Show more",
    min: "min", kcal: "kcal",
    diff: { easy:"Easy", medium:"Medium", hard:"Hard" },
    howto: "How to cook",
    share: "Share",
    shopList: "📋 Shopping list",
    orProducts: "or pick ingredients",
    calories: "Calories per dish",
    cookTime: "Cooking time",
    difficulty: "Difficulty",
    diet: "Diet",
    filters: "Filters",
    dietItems: ["🥗 Vegetarian","🌾 Gluten-free","☦️ Fasting","🥑 Keto","🥣 Digestive"],
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
    catLabel: "Category",
    prodLabel: "Products",
    selectedLabel: "Selected",
  },
};

// ── SVG ──────────────────────────────────────────────────────────────────────

function CheckIcon({ confirmed }) {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none"
      stroke={confirmed ? "#fb923c" : "#9ca3af"}
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="2,7 5.5,10.5 12,3.5" />
    </svg>
  );
}

function ShareSVG() {
  return (
    <svg width="14" height="14" viewBox="0 0 12 12" fill="none"
      stroke="#64748b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="2" r="1.3"/><circle cx="10" cy="10" r="1.3"/><circle cx="2" cy="6" r="1.3"/>
      <line x1="3.2" y1="5.4" x2="8.8" y2="2.6"/><line x1="3.2" y1="6.6" x2="8.8" y2="9.4"/>
    </svg>
  );
}

// ── SmartField ───────────────────────────────────────────────────────────────

function SmartField({ placeholder, value, onChange, onConfirm, confirmed, onClear, showClearWhenTyping }) {
  const hasText = value.trim().length > 0;
  const showCheck = hasText || confirmed;
  const showClear = confirmed || (showClearWhenTyping && hasText && !confirmed);

  return (
    <div style={{
      width: "100%",
      background: confirmed ? "rgba(234,88,12,0.08)" : "rgba(255,255,255,0.06)",
      border: confirmed ? "1px solid rgba(234,88,12,0.45)" : "1px solid rgba(255,255,255,0.1)",
      borderRadius: 12,
      padding: "12px 14px",
      display: "flex",
      alignItems: "center",
      gap: 10,
      marginBottom: 12,
      boxSizing: "border-box",
    }}>
      {confirmed && (
        <span style={{ color: "#fb923c", fontSize: 16, flexShrink: 0, lineHeight: 1 }}>✓</span>
      )}
      <input
        style={{
          flex: 1, background: "none", border: "none", outline: "none",
          fontSize: 16,
          color: (hasText || confirmed) ? "#f1f5f9" : "#64748b",
          fontWeight: confirmed ? 500 : 400,
        }}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && hasText && !confirmed) onConfirm(); }}
      />
      {showClear && onClear && (
        <button onClick={onClear} style={{
          background: "none", border: "none", color: "#64748b",
          fontSize: 13, cursor: "pointer", flexShrink: 0, padding: "0 4px",
        }}>очистить</button>
      )}
      {showCheck && (
        <button
          onClick={() => { if (hasText && !confirmed) onConfirm(); }}
          style={{
            background: confirmed ? "rgba(234,88,12,0.2)" : "rgba(255,255,255,0.08)",
            border: confirmed ? "1px solid rgba(234,88,12,0.5)" : "1px solid rgba(255,255,255,0.15)",
            borderRadius: 8, width: 36, height: 36,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, cursor: confirmed ? "default" : "pointer",
          }}>
          <CheckIcon confirmed={confirmed} />
        </button>
      )}
    </div>
  );
}

// ── DualSlider — touch + mouse drag ─────────────────────────────────────────

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
    if (disabled) return;
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
    <div ref={trackRef}
      style={{ position: "relative", height: 4, background: "rgba(255,255,255,0.07)", borderRadius: 2, margin: "10px 0 8px", opacity: disabled ? 0.3 : 1 }}>
      {/* Fill */}
      <div style={{ position: "absolute", height: 4, background: "rgba(234,88,12,0.5)", borderRadius: 2, left: `${minPct}%`, right: `${100 - maxPct}%` }} />
      {/* Left thumb */}
      <div
        onMouseDown={e => startDrag("min", e)}
        onTouchStart={e => startDrag("min", e)}
        style={{ position: "absolute", top: -8, left: `calc(${minPct}% - 10px)`, width: 20, height: 20, background: "#fb923c", borderRadius: "50%", boxShadow: "0 0 6px rgba(234,88,12,0.7)", cursor: disabled ? "default" : "grab", touchAction: "none", zIndex: 2 }} />
      {/* Right thumb */}
      <div
        onMouseDown={e => startDrag("max", e)}
        onTouchStart={e => startDrag("max", e)}
        style={{ position: "absolute", top: -8, left: `calc(${maxPct}% - 10px)`, width: 20, height: 20, background: "#fb923c", borderRadius: "50%", boxShadow: "0 0 6px rgba(234,88,12,0.7)", cursor: disabled ? "default" : "grab", touchAction: "none", zIndex: 2 }} />
    </div>
  );
}

// ── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [lang, setLang] = useState("ru");
  const t = DATA[lang];

  const [dish, setDish] = useState("");
  const [dishConfirmed, setDishConfirmed] = useState(false);

  const [activeCat, setActiveCat] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [productInput, setProductInput] = useState("");
  const [productConfirmed, setProductConfirmed] = useState(false);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [calMin, setCalMin] = useState(100);
  const [calMax, setCalMax] = useState(500);
  const [calAny, setCalAny] = useState(false);
  const [timeChip, setTimeChip] = useState("До 40 мин");
  const [diffChip, setDiffChip] = useState("Любая");
  const [activeDiets, setActiveDiets] = useState(new Set());

  const [recipes, setRecipes] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [openIdx, setOpenIdx] = useState(null);
  const [copiedIdx, setCopiedIdx] = useState(null);

  // Dish
  const confirmDish = () => { if (dish.trim()) setDishConfirmed(true); };
  const clearDish = () => { setDish(""); setDishConfirmed(false); };
  const handleDishChange = v => { setDish(v); setDishConfirmed(false); };

  // Product field
  const confirmProduct = () => {
    const v = productInput.trim();
    if (v) { setSelected(prev => new Set([...prev, v])); setProductInput(""); setProductConfirmed(false); }
  };
  const clearProduct = () => { setProductInput(""); setProductConfirmed(false); };
  const handleProductChange = v => { setProductInput(v); setProductConfirmed(false); };

  const removeProduct = item => setSelected(prev => { const n = new Set(prev); n.delete(item); return n; });
  const handleCatClick = key => setActiveCat(key);
  const toggle = item => setSelected(prev => { const n = new Set(prev); n.has(item) ? n.delete(item) : n.add(item); return n; });
  const toggleDiet = d => setActiveDiets(prev => { const n = new Set(prev); n.has(d) ? n.delete(d) : n.add(d); return n; });

  const handleSlider = (newMin, newMax) => { setCalMin(newMin); setCalMax(newMax); };

  const generate = useCallback(async () => {
    const hasDish = dishConfirmed && dish.trim();
    const hasIngredients = selected.size > 0;
    if (!hasDish && !hasIngredients) return;
    setApiError(false); setNoResults(false); setLoading(true); setRecipes(null); setOpenIdx(null);
    try {
      const res = await fetch(WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredients: [...selected],
          dish: hasDish ? dish.trim() : "",
          exclude: [],
          filters: { calMin: calAny ? 0 : calMin, calMax: calAny ? 99999 : calMax, time: timeChip, difficulty: diffChip, diets: [...activeDiets], lang },
        }),
        signal: AbortSignal.timeout(30000),
      });
      const text = await res.text();
      const data = JSON.parse(text.replace(/```json|```/g, "").trim());
      if (!data.recipes || data.recipes.length === 0) setNoResults(true);
      else { setRecipes(data.recipes); setOpenIdx(0); }
    } catch { setApiError(true); }
    setLoading(false);
  }, [dish, dishConfirmed, selected, calMin, calMax, calAny, timeChip, diffChip, activeDiets, lang]);

  const showMore = useCallback(async () => {
    const hasDish = dishConfirmed && dish.trim();
    const hasIngredients = selected.size > 0;
    if (!hasDish && !hasIngredients) return;
    setLoadingMore(true);
    try {
      const res = await fetch(WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredients: [...selected],
          dish: hasDish ? dish.trim() : "",
          exclude: recipes ? recipes.map(r => r.name) : [],
          filters: { calMin: calAny ? 0 : calMin, calMax: calAny ? 99999 : calMax, time: timeChip, difficulty: diffChip, diets: [...activeDiets], lang },
        }),
        signal: AbortSignal.timeout(30000),
      });
      const text = await res.text();
      const data = JSON.parse(text.replace(/```json|```/g, "").trim());
      if (data.recipes && data.recipes.length > 0) setRecipes(prev => [...(prev || []), ...data.recipes]);
    } catch { /* silent */ }
    setLoadingMore(false);
  }, [dish, dishConfirmed, selected, recipes, calMin, calMax, calAny, timeChip, diffChip, activeDiets, lang]);

  const handleShare = async r => {
    const text = `${r.emoji} ${r.name}\n⏱ ${r.time} ${t.min}\n\n${r.ingredients.join(", ")}`;
    if (navigator.share) await navigator.share({ title: r.name, text });
    else navigator.clipboard.writeText(text);
  };
  const handleShopList = (r, idx) => {
    navigator.clipboard.writeText(`🛒 ${r.name}\n\n${r.ingredients.join("\n")}`);
    setCopiedIdx(idx); setTimeout(() => setCopiedIdx(null), 2000);
  };

  const reset = () => { setRecipes(null); setNoResults(false); setApiError(false); setOpenIdx(null); };
  const canGenerate = (dishConfirmed && dish.trim()) || selected.size > 0;

  // Styles
  const sLabel = { fontSize: 12, fontWeight: 700, color: "#64748b", letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 8 };
  const sDiv = { height: 1, background: "rgba(255,255,255,0.05)", margin: "12px 0" };
  const sFilterBlock = { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "12px 14px" };
  const sChip = active => ({ background: active ? "rgba(234,88,12,0.12)" : "rgba(255,255,255,0.04)", border: active ? "1px solid rgba(234,88,12,0.4)" : "1px solid rgba(255,255,255,0.07)", borderRadius: 8, color: active ? "#fb923c" : "#64748b", fontSize: 14, padding: "6px 12px", cursor: "pointer" });
  const sPill = active => ({ background: active ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.04)", border: active ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(255,255,255,0.07)", borderRadius: 20, color: active ? "#6ee7b7" : "#64748b", fontSize: 14, padding: "7px 14px", cursor: "pointer" });

  return (
    <div style={{ minHeight: "100vh", background: "#0d0f14", display: "flex", justifyContent: "center", padding: "20px 16px 48px", fontFamily: "system-ui,-apple-system,sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 480, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 24, padding: 22 }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: 4 }}>{t.title}</div>
            <div style={{ fontSize: 13, color: "#64748b" }}>{t.subtitle}</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => { if (navigator.share) navigator.share({ title: t.title, url: window.location.href }); }}
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 9, color: "#64748b", padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center" }}>
              <ShareSVG />
            </button>
            <button onClick={() => setLang(l => l === "ru" ? "en" : "ru")}
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 9, color: "#64748b", fontSize: 13, fontWeight: 700, padding: "6px 12px", cursor: "pointer" }}>
              {lang === "ru" ? "EN" : "RU"}
            </button>
          </div>
        </div>

        {/* Results */}
        {(recipes || noResults || apiError) ? (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", letterSpacing: 1, textTransform: "uppercase", marginBottom: 14 }}>{t.results}</div>

            {noResults && (
              <div style={{ textAlign: "center", padding: "32px 12px" }}>
                <div style={{ fontSize: 40, marginBottom: 14 }}>🔍</div>
                <div style={{ fontSize: 17, fontWeight: 500, color: "#f1f5f9", marginBottom: 10 }}>{t.noResults}</div>
                <div style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6, marginBottom: 18 }}>{t.noResultsDesc}</div>
                <button onClick={reset} style={{ background: "rgba(234,88,12,0.12)", border: "1px solid rgba(234,88,12,0.35)", borderRadius: 50, color: "#fb923c", fontSize: 14, fontWeight: 600, padding: "12px 24px", cursor: "pointer" }}>{t.changeParams}</button>
              </div>
            )}

            {apiError && (
              <div style={{ textAlign: "center", padding: "32px 12px" }}>
                <div style={{ fontSize: 40, marginBottom: 14 }}>⚠️</div>
                <div style={{ fontSize: 17, fontWeight: 500, color: "#f1f5f9", marginBottom: 10 }}>{t.errorTitle}</div>
                <div style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6, marginBottom: 18 }}>{t.errorDesc}</div>
                <button onClick={generate} style={{ background: "#ea580c", border: "none", borderRadius: 50, color: "#fff", fontSize: 14, fontWeight: 600, padding: "12px 24px", cursor: "pointer" }}>{t.retry}</button>
              </div>
            )}

            {recipes && recipes.map((r, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, marginBottom: 12, overflow: "hidden" }}>
                <div onClick={() => setOpenIdx(openIdx === i ? null : i)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 16px", cursor: "pointer" }}>
                  <span style={{ fontSize: 30 }}>{r.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "#f1f5f9", marginBottom: 4 }}>{r.name}</div>
                    <div style={{ fontSize: 13, color: "#64748b" }}>
                      ⏱ {r.time} {t.min}
                      <span style={{ color: "#4ade80", marginLeft: 8 }}>● {t.diff[r.difficulty] || r.difficulty}</span>
                      {r.calories && <span style={{ color: "#fb923c", marginLeft: 8 }}>● {r.calories} {t.kcal}</span>}
                    </div>
                  </div>
                  <span style={{ color: "#64748b", fontSize: 12 }}>{openIdx === i ? "▲" : "▼"}</span>
                </div>
                {openIdx === i && (
                  <div style={{ padding: "14px 16px 16px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                      {r.ingredients.map((ing, j) => (
                        <span key={j} style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 8, color: "#6ee7b7", fontSize: 13, padding: "4px 10px" }}>{ing}</span>
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>{t.howto}</div>
                    {r.steps.map((step, j) => (
                      <div key={j} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
                        <span style={{ background: "rgba(234,88,12,0.15)", border: "1px solid rgba(234,88,12,0.3)", borderRadius: "50%", color: "#fb923c", fontSize: 12, fontWeight: 700, minWidth: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{j + 1}</span>
                        <span style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.5, textAlign: "left" }}>{step}</span>
                      </div>
                    ))}
                    <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                      <button onClick={() => handleShare(r)} style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#64748b", fontSize: 13, padding: "10px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        <ShareSVG /> {t.share}
                      </button>
                      <button onClick={() => handleShopList(r, i)} style={{ flex: 1, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 10, color: "#6ee7b7", fontSize: 13, padding: "10px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        {copiedIdx === i ? "✓ " + t.copiedMsg : t.shopList}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {recipes && (
              <button onClick={showMore} disabled={loadingMore}
                style={{ width: "100%", background: "rgba(234,88,12,0.12)", border: "1px solid rgba(234,88,12,0.35)", borderRadius: 50, color: "#fb923c", fontSize: 15, fontWeight: 600, padding: "14px 16px", cursor: loadingMore ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 6, opacity: loadingMore ? 0.7 : 1 }}>
                {loadingMore ? t.loadingMore : t.showMore}
              </button>
            )}
            <button onClick={reset} style={{ width: "100%", background: "none", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 50, color: "#64748b", fontSize: 14, padding: "12px 16px", cursor: "pointer", marginTop: 8 }}>
              {t.back}
            </button>
          </div>

        ) : (
          <>
            {/* Dish field */}
            <SmartField
              placeholder={t.dishPlaceholder}
              value={dish}
              onChange={handleDishChange}
              onConfirm={confirmDish}
              confirmed={dishConfirmed}
              onClear={clearDish}
              showClearWhenTyping={true}
            />

            {/* Or divider */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 12px" }}>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
              <span style={{ fontSize: 12, color: "#64748b" }}>{t.orProducts}</span>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
            </div>

            {/* Selected products — overflow hidden, scroll only inside */}
            {selected.size > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={sLabel}>{t.selectedLabel}: {selected.size}</span>
                  <button onClick={() => setSelected(new Set())} style={{ background: "none", border: "none", color: "#64748b", fontSize: 12, cursor: "pointer" }}>{t.clearAll}</button>
                </div>
                {/* overflow hidden на внешнем, scroll на внутреннем */}
                <div style={{ overflow: "hidden" }}>
                  <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6, scrollbarWidth: "none" }}>
                    {[...selected].map(item => (
                      <div key={item} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(234,88,12,0.13)", border: "1px solid rgba(234,88,12,0.4)", borderRadius: 20, color: "#fed7aa", fontSize: 14, padding: "6px 12px", whiteSpace: "nowrap", flexShrink: 0 }}>
                        ✓ {item}
                        <button onClick={() => removeProduct(item)} style={{ background: "none", border: "none", color: "#fb923c", fontSize: 16, cursor: "pointer", lineHeight: 1, padding: 0, marginLeft: 2 }}>×</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Categories */}
            <span style={sLabel}>{t.catLabel}</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {Object.entries(t.cats).map(([key, { label, icon }]) => (
                <div key={key} onClick={() => handleCatClick(key)}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: activeCat === key ? "rgba(234,88,12,0.13)" : "rgba(255,255,255,0.04)", border: activeCat === key ? "1px solid rgba(234,88,12,0.45)" : "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "10px 12px", minWidth: 64, cursor: "pointer" }}>
                  <span style={{ fontSize: 22 }}>{icon}</span>
                  <span style={{ fontSize: 12, color: activeCat === key ? "#fb923c" : "#64748b" }}>{label}</span>
                </div>
              ))}
            </div>

            {/* Products */}
            {activeCat && (
              <>
                <div style={sDiv} />
                <span style={{ ...sLabel, marginBottom: 10 }}>{t.prodLabel}</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                  {t.items[activeCat].map(item => (
                    <button key={item} onClick={() => toggle(item)}
                      style={{ background: selected.has(item) ? "rgba(234,88,12,0.13)" : "rgba(255,255,255,0.04)", border: selected.has(item) ? "1.5px solid rgba(234,88,12,0.5)" : "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: selected.has(item) ? "#fed7aa" : "#64748b", fontSize: 15, padding: "8px 14px", cursor: "pointer" }}>
                      {selected.has(item) ? "✓ " : ""}{item}
                    </button>
                  ))}
                </div>
                <SmartField
                  placeholder={t.addProductPlaceholder}
                  value={productInput}
                  onChange={handleProductChange}
                  onConfirm={confirmProduct}
                  confirmed={productConfirmed}
                  onClear={clearProduct}
                  showClearWhenTyping={false}
                />
              </>
            )}

            <div style={sDiv} />

            {/* Filters toggle button */}
            <button
              onClick={() => setFiltersOpen(o => !o)}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "13px 16px", cursor: "pointer", marginBottom: filtersOpen ? 12 : 16 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: "#94a3b8" }}>{t.filters}</span>
              <span style={{ fontSize: 13, color: "#64748b" }}>{filtersOpen ? "▲" : "▼"}</span>
            </button>

            {/* Filters content */}
            {filtersOpen && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>

                {/* Calorie slider */}
                <div style={sFilterBlock}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: "#64748b" }}>{t.calories}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#fb923c" }}>
                      {calAny ? t.calAny : `${calMin} — ${calMax} ${t.kcal}`}
                    </span>
                  </div>
                  <DualSlider min={100} max={1000} valMin={calMin} valMax={calMax} onChange={handleSlider} disabled={calAny} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b", marginBottom: 10 }}><span>100</span><span>1000</span></div>
                  <button onClick={() => setCalAny(a => !a)} style={sChip(calAny)}>{t.calAny}</button>
                </div>

                {/* Time */}
                <div style={sFilterBlock}>
                  <div style={{ marginBottom: 10 }}><span style={{ fontSize: 13, color: "#64748b" }}>{t.cookTime}</span></div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {t.timeChips.map(c => <button key={c} onClick={() => setTimeChip(c)} style={sChip(timeChip === c)}>{c}</button>)}
                  </div>
                </div>

                {/* Difficulty */}
                <div style={sFilterBlock}>
                  <div style={{ marginBottom: 10 }}><span style={{ fontSize: 13, color: "#64748b" }}>{t.difficulty}</span></div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {t.diffChips.map(c => <button key={c} onClick={() => setDiffChip(c)} style={sChip(diffChip === c)}>{c}</button>)}
                  </div>
                </div>

                {/* Diet */}
                <div style={sFilterBlock}>
                  <div style={{ marginBottom: 10 }}><span style={{ fontSize: 13, color: "#64748b" }}>{t.diet}</span></div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {t.dietItems.map(d => <button key={d} onClick={() => toggleDiet(d)} style={sPill(activeDiets.has(d))}>{d}</button>)}
                  </div>
                </div>
              </div>
            )}

            {/* CTA */}
            <button onClick={generate} disabled={loading || !canGenerate}
              style={{ width: "100%", background: (!canGenerate || loading) ? "rgba(234,88,12,0.4)" : "#ea580c", border: "none", borderRadius: 50, color: "#fff", fontSize: 16, fontWeight: 700, padding: "15px 16px", cursor: (!canGenerate || loading) ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {loading ? t.loading : t.btn}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
