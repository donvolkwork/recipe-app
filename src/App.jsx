import { useState, useCallback } from "react";

const WORKER_URL = "https://recipe-backend-production-416c.up.railway.app/api/recipes";

const DATA = {
  ru: {
    title: "Что приготовить?",
    subtitle: "Выбери продукты — найдём рецепт",
    cats: { meat: "🥩 Мясо", fish: "🐟 Рыба", veggies: "🥦 Овощи", dairy: "🧀 Молочное", grains: "🌾 Крупы", other: "🧂 Прочее" },
    items: {
      meat: ["Курица", "Говядина", "Свинина", "Фарш", "Бекон"],
      fish: ["Лосось", "Треска", "Тунец", "Креветки", "Сельдь"],
      veggies: ["Картошка", "Лук", "Чеснок", "Морковь", "Помидор", "Перец", "Баклажан", "Кабачок"],
      dairy: ["Яйца", "Молоко", "Сыр", "Сметана", "Масло", "Творог"],
      grains: ["Рис", "Гречка", "Паста", "Овсянка", "Перловка"],
      other: ["Оливковое масло", "Соевый соус", "Томатная паста", "Грибы", "Фасоль"],
    },
    placeholder: "Добавить продукт...",
    btn: "🍳 Что приготовить?",
    loading: "Придумываю рецепты...",
    selected: "Выбрано",
    clear: "Очистить",
    empty: "Выбери хотя бы один продукт",
    results: "Варианты блюд",
    back: "← Назад",
    min: "мин",
    diff: { easy: "Просто", medium: "Средне", hard: "Сложно" },
    howto: "Как готовить",
  },
  en: {
    title: "What to cook?",
    subtitle: "Pick ingredients — find a recipe",
    cats: { meat: "🥩 Meat", fish: "🐟 Fish", veggies: "🥦 Veggies", dairy: "🧀 Dairy", grains: "🌾 Grains", other: "🧂 Other" },
    items: {
      meat: ["Chicken", "Beef", "Pork", "Ground meat", "Bacon"],
      fish: ["Salmon", "Cod", "Tuna", "Shrimp", "Herring"],
      veggies: ["Potato", "Onion", "Garlic", "Carrot", "Tomato", "Pepper", "Eggplant", "Zucchini"],
      dairy: ["Eggs", "Milk", "Cheese", "Sour cream", "Butter", "Cottage cheese"],
      grains: ["Rice", "Buckwheat", "Pasta", "Oatmeal", "Barley"],
      other: ["Olive oil", "Soy sauce", "Tomato paste", "Mushrooms", "Beans"],
    },
    placeholder: "Add ingredient...",
    btn: "🍳 What can I cook?",
    loading: "Finding recipes...",
    selected: "Selected",
    clear: "Clear",
    empty: "Pick at least one ingredient",
    results: "Recipe ideas",
    back: "← Back",
    min: "min",
    diff: { easy: "Easy", medium: "Medium", hard: "Hard" },
    howto: "How to cook",
  },
};

export default function App() {
  const [lang, setLang] = useState("ru");
  const [cat, setCat] = useState("veggies");
  const [selected, setSelected] = useState(new Set());
  const [custom, setCustom] = useState("");
  const [customList, setCustomList] = useState([]);
  const [recipes, setRecipes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [openIdx, setOpenIdx] = useState(null);

  const t = DATA[lang];

  const toggle = (item) => {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(item) ? n.delete(item) : n.add(item);
      return n;
    });
  };

  const addCustom = () => {
    const v = custom.trim();
    if (v && !customList.includes(v)) {
      setCustomList(p => [...p, v]);
      setSelected(p => new Set([...p, v]));
    }
    setCustom("");
  };

  const generate = useCallback(async () => {
    if (selected.size === 0) { setError(t.empty); return; }
    setError("");
    setLoading(true);
    try {
      const res = await fetch(WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients: [...selected].join(", ") }),
      });
      const text = await res.text();
      const clean = text.replace(/```json|```/g, "").trim();
      const data = JSON.parse(clean);
      setRecipes(data);
    } catch (e) {
      setError("Ошибка: " + e.message);
    }
    setLoading(false);
  }, [selected, t]);

  const dc = { easy: "#4ade80", medium: "#fb923c", hard: "#f87171" };

  const chip = (item, dashed) => ({
    background: selected.has(item) ? "rgba(234,88,12,0.2)" : "rgba(255,255,255,0.05)",
    border: selected.has(item) ? "1px solid rgba(234,88,12,0.5)" : dashed ? "1px dashed rgba(255,255,255,0.2)" : "1px solid rgba(255,255,255,0.1)",
    borderRadius: 20,
    color: selected.has(item) ? "#fed7aa" : "#cbd5e1",
    fontSize: 13,
    padding: "7px 14px",
    cursor: "pointer",
  });

  return (
    <div style={{ minHeight: "100vh", background: "#0d0f14", display: "flex", justifyContent: "center", padding: "20px 16px 48px", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 480, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 24, padding: 22 }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: 4 }}>{t.title}</div>
            <div style={{ fontSize: 13, color: "#64748b" }}>{t.subtitle}</div>
          </div>
          <button onClick={() => setLang(l => l === "ru" ? "en" : "ru")} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#94a3b8", fontSize: 12, fontWeight: 700, padding: "5px 10px", cursor: "pointer", flexShrink: 0, marginTop: 4 }}>
            {lang === "ru" ? "EN" : "RU"}
          </button>
        </div>

        {recipes ? (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: 1, textTransform: "uppercase", marginBottom: 14 }}>{t.results}</div>
            {recipes.map((r, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, marginBottom: 10, overflow: "hidden" }}>
                <div onClick={() => setOpenIdx(openIdx === i ? null : i)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", cursor: "pointer" }}>
                  <span style={{ fontSize: 28 }}>{r.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#f1f5f9", marginBottom: 4 }}>{lang === "ru" ? r.nameRu : r.name}</div>
                    <div style={{ fontSize: 12 }}>
                      <span style={{ color: "#94a3b8" }}>⏱ {r.time} {t.min}</span>
                      <span style={{ color: dc[r.difficulty] || "#fb923c", marginLeft: 10 }}>● {t.diff[r.difficulty] || r.difficulty}</span>
                    </div>
                  </div>
                  <span style={{ color: "#475569", fontSize: 10 }}>{openIdx === i ? "▲" : "▼"}</span>
                </div>
                {openIdx === i && (
                  <div style={{ padding: "14px 16px 16px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                      {r.ingredients.map((ing, j) => (
                        <span key={j} style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 6, color: "#6ee7b7", fontSize: 11, padding: "3px 8px" }}>{ing}</span>
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: "#475569", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>{t.howto}</div>
                    {r.steps.map((step, j) => (
                      <div key={j} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
                        <span style={{ background: "rgba(234,88,12,0.15)", border: "1px solid rgba(234,88,12,0.3)", borderRadius: "50%", color: "#fb923c", fontSize: 11, fontWeight: 700, minWidth: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{j + 1}</span>
                        <span style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.5 }}>{step}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <button onClick={() => { setRecipes(null); setOpenIdx(null); }} style={{ width: "100%", background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#64748b", fontSize: 13, padding: "10px 16px", cursor: "pointer", marginTop: 6 }}>
              {t.back}
            </button>
          </div>
        ) : (
          <>
            {selected.size > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(234,88,12,0.12)", border: "1px solid rgba(234,88,12,0.25)", borderRadius: 10, padding: "8px 12px", marginBottom: 14 }}>
                <span style={{ fontSize: 13, color: "#fb923c", fontWeight: 500 }}>✓ {t.selected}: {selected.size}</span>
                <button onClick={() => setSelected(new Set())} style={{ background: "none", border: "none", color: "#64748b", fontSize: 12, cursor: "pointer" }}>{t.clear}</button>
              </div>
            )}

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
              {Object.entries(t.cats).map(([key, label]) => (
                <button key={key} onClick={() => setCat(key)} style={{ background: cat === key ? "rgba(234,88,12,0.15)" : "rgba(255,255,255,0.05)", border: cat === key ? "1px solid rgba(234,88,12,0.4)" : "1px solid rgba(255,255,255,0.06)", borderRadius: 20, color: cat === key ? "#fb923c" : "#64748b", fontSize: 12, padding: "6px 12px", cursor: "pointer" }}>
                  {label}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16, minHeight: 80 }}>
              {t.items[cat].map(item => (
                <button key={item} onClick={() => toggle(item)} style={chip(item, false)}>
                  {selected.has(item) && "✓ "}{item}
                </button>
              ))}
              {customList.map(item => (
                <button key={item} onClick={() => toggle(item)} style={chip(item, true)}>
                  {selected.has(item) && "✓ "}{item}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input value={custom} onChange={e => setCustom(e.target.value)} onKeyDown={e => e.key === "Enter" && addCustom()} placeholder={t.placeholder} style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#e2e8f0", fontSize: 13, padding: "10px 14px", outline: "none" }} />
              <button onClick={addCustom} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, color: "#94a3b8", fontSize: 20, width: 42, height: 42, cursor: "pointer", flexShrink: 0 }}>+</button>
            </div>

            {error && <div style={{ color: "#f87171", fontSize: 12, marginBottom: 10, padding: "8px 12px", background: "rgba(248,113,113,0.08)", borderRadius: 8 }}>{error}</div>}

            <button onClick={generate} disabled={loading} style={{ width: "100%", background: loading ? "rgba(234,88,12,0.5)" : "linear-gradient(135deg, #ea580c, #f97316)", border: "none", borderRadius: 14, color: "#fff", fontSize: 15, fontWeight: 700, padding: "14px", cursor: loading ? "wait" : "pointer", boxShadow: "0 8px 32px rgba(234,88,12,0.3)" }}>
              {loading ? t.loading : t.btn}
            </button>
          </>
        )}
      </div>
    </div>
  );
}