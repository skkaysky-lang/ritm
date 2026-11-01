import { useMemo, useState } from 'react';
import { useStore, type Food, type FoodEntry, type Macros, type Meal } from '../store';
import { FOOD_EMOJI, FOODS, searchFoods } from '../data/foods';
import { round1, scaleMacros, sumMacros } from '../lib/calc';
import { addDays, dayKey, lastDays } from '../lib/date';
import { haptic } from '../lib/telegram';
import { Icon } from './Icon';
import { Empty, NumInput, Segmented, Sheet, toast } from './ui';

export const MEALS: { id: Meal; label: string; emoji: string }[] = [
  { id: 'breakfast', label: 'Завтрак', emoji: '🍳' },
  { id: 'lunch', label: 'Обед', emoji: '🍲' },
  { id: 'dinner', label: 'Ужин', emoji: '🍽️' },
  { id: 'snack', label: 'Перекус', emoji: '🍎' },
];
export const mealLabel = (m: Meal) => MEALS.find((x) => x.id === m)!.label;

export function defaultMeal(): Meal {
  const h = new Date().getHours();
  if (h < 11) return 'breakfast';
  if (h < 16) return 'lunch';
  if (h >= 18 && h < 22) return 'dinner';
  return 'snack';
}

export function MacroLine({ m, kcal = true }: { m: Macros; kcal?: boolean }) {
  return (
    <div className="kbju num">
      {kcal && <span>{Math.round(m.kcal)} ккал</span>}
      <span>
        <i className="dot" style={{ background: 'var(--protein)', width: 6, height: 6 }} />Б {round1(m.p)}
      </span>
      <span>
        <i className="dot" style={{ background: 'var(--fat)', width: 6, height: 6 }} />Ж {round1(m.f)}
      </span>
      <span>
        <i className="dot" style={{ background: 'var(--carbs)', width: 6, height: 6 }} />У {round1(m.c)}
      </span>
    </div>
  );
}

/** Превращает запись из дневника в «продукт», чтобы её можно было добавить снова с другой порцией */
function entryToFood(e: FoodEntry): Food {
  if (e.grams && e.grams > 0) {
    const k = 100 / e.grams;
    return { id: e.foodId ?? 'r_' + e.name, name: e.name, emoji: e.emoji, kcal: e.kcal * k, p: e.p * k, f: e.f * k, c: e.c * k };
  }
  return { id: 'r_' + e.name, name: e.name, emoji: e.emoji, kcal: e.kcal, p: e.p, f: e.f, c: e.c, unit: { name: 'порция', grams: 100 } };
}

type Tab = 'search' | 'fav' | 'my' | 'manual';

export function AddFoodSheet({ open, onClose, day, meal: initialMeal }: { open: boolean; onClose: () => void; day: string; meal?: Meal }) {
  const s = useStore();
  const [meal, setMeal] = useState<Meal>(initialMeal ?? defaultMeal());
  const [tab, setTab] = useState<Tab>('search');
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Food | null>(null);
  const [added, setAdded] = useState(0);
  const [creating, setCreating] = useState(false);

  // при каждом открытии — сброс
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setMeal(initialMeal ?? defaultMeal());
      setTab('search');
      setQ('');
      setPicked(null);
      setAdded(0);
      setCreating(false);
    }
  }

  const all = useMemo(() => [...s.customFoods, ...FOODS], [s.customFoods]);
  const byId = useMemo(() => new Map(all.map((f) => [f.id, f])), [all]);

  const recents = useMemo(() => {
    const seen = new Set<string>();
    const out: Food[] = [];
    for (const k of lastDays(21).reverse()) {
      const list = [...(s.food[k] ?? [])].reverse();
      for (const e of list) {
        const key = e.foodId ?? e.name;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push((e.foodId && byId.get(e.foodId)) || entryToFood(e));
        if (out.length >= 8) return out;
      }
    }
    return out;
  }, [s.food, byId]);

  const results = useMemo(() => (q ? searchFoods(all, q).slice(0, 40) : []), [q, all]);
  const favs = s.favorites.map((id) => byId.get(id)).filter(Boolean) as Food[];

  const add = (e: Omit<FoodEntry, 'id' | 'time' | 'meal'>) => {
    s.addFood(day, { ...e, meal });
    haptic.success();
    setAdded((n) => n + 1);
    toast(`${e.emoji} ${e.name} · ${Math.round(e.kcal)} ккал`);
    setPicked(null);
  };

  const FoodRow = ({ f }: { f: Food }) => {
    const fav = s.favorites.includes(f.id);
    const canFav = !f.id.startsWith('r_');
    return (
      <div className="list-item">
        <button className="row grow" style={{ textAlign: 'left' }} onClick={() => (haptic.light(), setPicked(f))}>
          <div className="emoji-box sm">{f.emoji}</div>
          <div className="grow">
            <div className="bold ellipsis">{f.name}</div>
            <div className="tiny muted num">
              {Math.round(f.kcal)} ккал · Б {round1(f.p)} Ж {round1(f.f)} У {round1(f.c)} {f.unit?.name === 'порция' ? 'на порцию' : 'на 100 г'}
            </div>
          </div>
        </button>
        {canFav && (
          <button className="icon-btn sm plain" onClick={() => (haptic.select(), s.toggleFavorite(f.id))} style={{ color: fav ? 'var(--warn)' : 'var(--text-3)' }} aria-label="Избранное">
            <Icon name={fav ? 'star-fill' : 'star'} size={19} />
          </button>
        )}
      </div>
    );
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      full
      title={picked ? 'Порция' : 'Добавить еду'}
      right={
        added > 0 && !picked ? (
          <button className="btn sm" style={{ ['--c1' as string]: 'var(--good)', ['--c2' as string]: '#19b3d6' }} onClick={onClose}>
            Готово · {added}
          </button>
        ) : null
      }
    >
      {picked ? (
        <PortionView food={picked} meal={meal} onBack={() => setPicked(null)} onAdd={add} />
      ) : (
        <div className="stack">
          <div className="chips">
            {MEALS.map((m) => (
              <button key={m.id} className={`chip ${meal === m.id ? 'on' : ''}`} onClick={() => (haptic.select(), setMeal(m.id))}>
                {m.emoji} {m.label}
              </button>
            ))}
          </div>
          <Segmented
            value={tab}
            onChange={(v) => {
              setTab(v);
              setCreating(false);
            }}
            options={[
              { v: 'search', label: 'Поиск' },
              { v: 'fav', label: '⭐' },
              { v: 'my', label: 'Мои' },
              { v: 'manual', label: 'Вручную' },
            ]}
          />

          {tab === 'search' && (
            <>
              <div className="input-wrap has-prefix">
                <span className="prefix">
                  <Icon name="search" size={19} />
                </span>
                <input className="input" placeholder="Гречка, банан, кофе…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              {q ? (
                results.length ? (
                  <div className="list">
                    {results.map((f) => (
                      <FoodRow key={f.id} f={f} />
                    ))}
                  </div>
                ) : (
                  <Empty emoji="🔎" text={`«${q}» нет в базе`}>
                    <button className="btn sm" onClick={() => setTab('manual')}>
                      Ввести КБЖУ вручную
                    </button>
                  </Empty>
                )
              ) : (
                <>
                  {recents.length > 0 && (
                    <>
                      <div className="section-title">Недавние</div>
                      <div className="list">
                        {recents.map((f) => (
                          <FoodRow key={'r' + f.id} f={f} />
                        ))}
                      </div>
                    </>
                  )}
                  <div className="section-title">Популярное</div>
                  <div className="list">
                    {FOODS.slice(0, 40).map((f) => (
                      <FoodRow key={f.id} f={f} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {tab === 'fav' &&
            (favs.length ? (
              <div className="list">
                {favs.map((f) => (
                  <FoodRow key={f.id} f={f} />
                ))}
              </div>
            ) : (
              <Empty emoji="⭐" text="Нажми на звёздочку у продукта, и он появится здесь" />
            ))}

          {tab === 'my' &&
            (creating ? (
              <CustomFoodForm
                onDone={(id) => {
                  setCreating(false);
                  const f = useStore.getState().customFoods.find((x) => x.id === id);
                  if (f) setPicked(f);
                }}
              />
            ) : (
              <>
                <button className="btn ghost" onClick={() => setCreating(true)}>
                  <Icon name="plus" size={18} /> Новый продукт
                </button>
                {s.templates.length > 0 && (
                  <>
                    <div className="section-title">Мои блюда</div>
                    <div className="list">
                      {s.templates.map((t) => {
                        const m = sumMacros(t.items);
                        return (
                          <div key={t.id} className="list-item">
                            <button
                              className="row grow"
                              style={{ textAlign: 'left' }}
                              onClick={() => {
                                s.applyTemplate(day, meal, t.id);
                                haptic.success();
                                setAdded((n) => n + t.items.length);
                                toast(`${t.emoji} ${t.name} · ${Math.round(m.kcal)} ккал`);
                              }}
                            >
                              <div className="emoji-box sm">{t.emoji}</div>
                              <div className="grow">
                                <div className="bold ellipsis">{t.name}</div>
                                <div className="tiny muted">
                                  {t.items.length} поз. · {Math.round(m.kcal)} ккал
                                </div>
                              </div>
                            </button>
                            <button className="icon-btn sm plain faint" onClick={() => (s.removeTemplate(t.id), toast('Блюдо удалено'))} aria-label="Удалить">
                              <Icon name="trash" size={17} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
                {s.customFoods.length > 0 && (
                  <>
                    <div className="section-title">Мои продукты</div>
                    <div className="list">
                      {s.customFoods.map((f) => (
                        <FoodRow key={f.id} f={f} />
                      ))}
                    </div>
                  </>
                )}
                {!s.templates.length && !s.customFoods.length && (
                  <Empty emoji="🧑‍🍳" text="Здесь будут твои продукты и блюда. Чтобы сохранить блюдо, нажми «⋯» у приёма пищи и выбери «Сохранить как блюдо»" />
                )}
              </>
            ))}

          {tab === 'manual' && <ManualForm initialName={q} onAdd={add} />}
        </div>
      )}
    </Sheet>
  );
}

/* ---------- выбор порции ---------- */

function PortionView({ food, meal, onBack, onAdd }: { food: Food; meal: Meal; onBack: () => void; onAdd: (e: Omit<FoodEntry, 'id' | 'time' | 'meal'>) => void }) {
  const isPortion = food.unit?.name === 'порция';
  const [grams, setGrams] = useState<number | ''>(food.unit ? food.unit.grams : 100);
  const g = Number(grams) || 0;
  const m = scaleMacros(food, g);
  const chips: { label: string; g: number }[] = [];
  if (food.unit) {
    const u = food.unit;
    const name = isPortion ? 'порц.' : u.name;
    [0.5, 1, 2, 3].forEach((n) => chips.push({ label: `${n === 0.5 ? '½' : n} ${name}`, g: u.grams * n }));
  }
  if (!isPortion) [50, 100, 150, 200, 300].forEach((n) => chips.push({ label: `${n} г`, g: n }));

  return (
    <div className="stack">
      <button className="row" onClick={onBack}>
        <Icon name="left" size={18} />
        <span className="small muted bold">Назад к списку</span>
      </button>
      <div className="row">
        <div className="emoji-box lg">{food.emoji}</div>
        <div className="grow">
          <div className="bold" style={{ fontSize: 18 }}>
            {food.name}
          </div>
          <div className="small muted">{isPortion ? 'на порцию' : `${Math.round(food.kcal)} ккал на 100 г`}</div>
        </div>
      </div>
      <div className="card" style={{ background: 'var(--surface-2)' }}>
        <div className="row" style={{ justifyContent: 'center', gap: 6 }}>
          <input
            className="big-input num"
            inputMode="decimal"
            value={grams}
            style={{ width: 140 }}
            onFocus={(e) => e.target.select()}
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d.,]/g, '').replace(',', '.');
              setGrams(v === '' ? '' : Number(v));
            }}
          />
          <span className="muted bold" style={{ fontSize: 20 }}>
            {isPortion ? '% порции' : 'г'}
          </span>
        </div>
        <div className="chips wrap" style={{ marginTop: 12, justifyContent: 'center' }}>
          {chips.map((c) => (
            <button key={c.label} className={`chip ${g === c.g ? 'on' : ''}`} onClick={() => (haptic.select(), setGrams(c.g))}>
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid-4">
        {(
          [
            ['Ккал', m.kcal, 'var(--food)', ''],
            ['Белки', m.p, 'var(--protein)', 'г'],
            ['Жиры', m.f, 'var(--fat)', 'г'],
            ['Углев.', m.c, 'var(--carbs)', 'г'],
          ] as const
        ).map(([l, v, c, u]) => (
          <div key={l} className="stat-box stat center" style={{ padding: '10px 4px' }}>
            <span className="v num" style={{ color: c, fontSize: 18 }}>
              {u ? round1(v) : Math.round(v)}
              <small>{u}</small>
            </span>
            <span className="l">{l}</span>
          </div>
        ))}
      </div>
      <button
        className="btn"
        disabled={g <= 0}
        style={{ ['--c1' as string]: 'var(--food)', ['--c2' as string]: 'var(--food-2)' }}
        onClick={() =>
          onAdd({
            name: food.name,
            emoji: food.emoji,
            grams: isPortion ? undefined : g,
            foodId: food.id.startsWith('r_') ? undefined : food.id,
            ...m,
          })
        }
      >
        Добавить в «{mealLabel(meal).toLowerCase()}»
      </button>
    </div>
  );
}

/* ---------- ручной ввод ---------- */

function ManualForm({ initialName, onAdd }: { initialName: string; onAdd: (e: Omit<FoodEntry, 'id' | 'time' | 'meal'>) => void }) {
  const addCustom = useStore((s) => s.addCustomFood);
  const [name, setName] = useState(initialName);
  const [emoji, setEmoji] = useState('🍽️');
  const [kcal, setKcal] = useState<number | ''>('');
  const [p, setP] = useState<number | ''>('');
  const [f, setF] = useState<number | ''>('');
  const [c, setC] = useState<number | ''>('');
  const [grams, setGrams] = useState<number | ''>('');
  const [save, setSave] = useState(false);
  const autoKcal = Math.round((Number(p) || 0) * 4 + (Number(f) || 0) * 9 + (Number(c) || 0) * 4);
  const finalKcal = kcal === '' ? autoKcal : Number(kcal);

  return (
    <div className="stack">
      <div className="row">
        <EmojiPicker value={emoji} onChange={setEmoji} />
        <input className="input" placeholder="Название (необязательно)" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label>Калории</label>
        <NumInput value={kcal} onChange={setKcal} suffix="ккал" placeholder={autoKcal ? `${autoKcal} (по БЖУ)` : '0'} />
      </div>
      <div className="grid-3">
        <div className="field">
          <label style={{ color: 'var(--protein)' }}>Белки</label>
          <NumInput value={p} onChange={setP} suffix="г" step={0.1} placeholder="0" />
        </div>
        <div className="field">
          <label style={{ color: 'var(--fat)' }}>Жиры</label>
          <NumInput value={f} onChange={setF} suffix="г" step={0.1} placeholder="0" />
        </div>
        <div className="field">
          <label style={{ color: 'var(--carbs)' }}>Углеводы</label>
          <NumInput value={c} onChange={setC} suffix="г" step={0.1} placeholder="0" />
        </div>
      </div>
      <div className="field">
        <label>Вес порции (необязательно)</label>
        <NumInput value={grams} onChange={setGrams} suffix="г" placeholder="—" />
      </div>
      <button className="row-between" onClick={() => (haptic.select(), setSave(!save))}>
        <span className="small bold">Сохранить в «Мои продукты»</span>
        <span className={`toggle ${save ? 'on' : ''}`} />
      </button>
      <button
        className="btn"
        disabled={finalKcal <= 0}
        style={{ ['--c1' as string]: 'var(--food)', ['--c2' as string]: 'var(--food-2)' }}
        onClick={() => {
          const m = { kcal: finalKcal, p: Number(p) || 0, f: Number(f) || 0, c: Number(c) || 0 };
          const g = Number(grams) || undefined;
          let foodId: string | undefined;
          if (save) {
            const k = g ? 100 / g : 1;
            foodId = addCustom({
              name: name || 'Мой продукт',
              emoji,
              kcal: m.kcal * k,
              p: m.p * k,
              f: m.f * k,
              c: m.c * k,
              unit: g ? undefined : { name: 'порция', grams: 100 },
            });
          }
          onAdd({ name: name || 'Перекус', emoji, grams: g, foodId, ...m });
          setKcal('');
          setP('');
          setF('');
          setC('');
          setGrams('');
          setName('');
        }}
      >
        Добавить {finalKcal > 0 ? `· ${finalKcal} ккал` : ''}
      </button>
    </div>
  );
}

/* ---------- свой продукт (на 100 г) ---------- */

function CustomFoodForm({ onDone }: { onDone: (id: string) => void }) {
  const addCustom = useStore((s) => s.addCustomFood);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🍽️');
  const [kcal, setKcal] = useState<number | ''>('');
  const [p, setP] = useState<number | ''>('');
  const [f, setF] = useState<number | ''>('');
  const [c, setC] = useState<number | ''>('');
  const [unitName, setUnitName] = useState('');
  const [unitG, setUnitG] = useState<number | ''>('');
  const auto = Math.round((Number(p) || 0) * 4 + (Number(f) || 0) * 9 + (Number(c) || 0) * 4);
  const k = kcal === '' ? auto : Number(kcal);
  return (
    <div className="stack">
      <div className="small muted">Значения с упаковки, на 100 г продукта.</div>
      <div className="row">
        <EmojiPicker value={emoji} onChange={setEmoji} />
        <input className="input" placeholder="Название" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
      <div className="field">
        <label>Калории на 100 г</label>
        <NumInput value={kcal} onChange={setKcal} suffix="ккал" placeholder={auto ? `${auto} (по БЖУ)` : '0'} />
      </div>
      <div className="grid-3">
        <div className="field">
          <label style={{ color: 'var(--protein)' }}>Белки</label>
          <NumInput value={p} onChange={setP} suffix="г" step={0.1} placeholder="0" />
        </div>
        <div className="field">
          <label style={{ color: 'var(--fat)' }}>Жиры</label>
          <NumInput value={f} onChange={setF} suffix="г" step={0.1} placeholder="0" />
        </div>
        <div className="field">
          <label style={{ color: 'var(--carbs)' }}>Углеводы</label>
          <NumInput value={c} onChange={setC} suffix="г" step={0.1} placeholder="0" />
        </div>
      </div>
      <div className="grid-2">
        <div className="field">
          <label>Штука (необязательно)</label>
          <input className="input" placeholder="шт, ломтик…" value={unitName} onChange={(e) => setUnitName(e.target.value)} />
        </div>
        <div className="field">
          <label>Вес штуки</label>
          <NumInput value={unitG} onChange={setUnitG} suffix="г" placeholder="—" />
        </div>
      </div>
      <button
        className="btn"
        disabled={!name.trim() || k <= 0}
        onClick={() => {
          const id = addCustom({
            name: name.trim(),
            emoji,
            kcal: k,
            p: Number(p) || 0,
            f: Number(f) || 0,
            c: Number(c) || 0,
            unit: unitName && Number(unitG) ? { name: unitName, grams: Number(unitG) } : undefined,
          });
          haptic.success();
          toast('Продукт сохранён');
          onDone(id);
        }}
      >
        Сохранить продукт
      </button>
    </div>
  );
}

export function EmojiPicker({ value, onChange, list = FOOD_EMOJI }: { value: string; onChange: (e: string) => void; list?: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="emoji-box" style={{ width: 48, height: 48 }} onClick={() => setOpen(true)} aria-label="Выбрать эмодзи">
        {value}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Эмодзи">
        <div className="emoji-grid">
          {list.map((e) => (
            <button
              key={e}
              className={e === value ? 'on' : ''}
              onClick={() => {
                haptic.select();
                onChange(e);
                setOpen(false);
              }}
            >
              {e}
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}

/* ---------- правка записи ---------- */

export function FoodEntrySheet({ entry, day, onClose }: { entry: FoodEntry | null; day: string; onClose: () => void }) {
  const s = useStore();
  const [grams, setGrams] = useState<number | ''>('');
  const [meal, setMeal] = useState<Meal>('snack');
  const [cur, setCur] = useState<string | null>(null);
  if (entry && entry.id !== cur) {
    setCur(entry.id);
    setGrams(entry.grams ?? '');
    setMeal(entry.meal);
  }
  if (!entry && cur) setCur(null);

  const e = entry;
  const per100 = e && e.grams ? { kcal: (e.kcal * 100) / e.grams, p: (e.p * 100) / e.grams, f: (e.f * 100) / e.grams, c: (e.c * 100) / e.grams } : null;
  const g = Number(grams) || 0;
  const m = e ? (per100 && g ? scaleMacros(per100, g) : { kcal: e.kcal, p: e.p, f: e.f, c: e.c }) : { kcal: 0, p: 0, f: 0, c: 0 };

  return (
    <Sheet open={!!entry} onClose={onClose} title="Запись">
      {e && (
        <div className="stack">
          <div className="row">
            <div className="emoji-box lg">{e.emoji}</div>
            <div className="grow">
              <div className="bold" style={{ fontSize: 18 }}>
                {e.name}
              </div>
              <MacroLine m={m} />
            </div>
          </div>
          {per100 && (
            <div className="field">
              <label>Вес, г</label>
              <NumInput value={grams} onChange={setGrams} suffix="г" />
            </div>
          )}
          <div className="field">
            <label>Приём пищи</label>
            <div className="chips wrap">
              {MEALS.map((x) => (
                <button key={x.id} className={`chip ${meal === x.id ? 'on' : ''}`} onClick={() => (haptic.select(), setMeal(x.id))}>
                  {x.emoji} {x.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid-2">
            <button
              className="btn danger"
              onClick={() => {
                const removed = s.removeFood(day, e.id);
                haptic.warning();
                onClose();
                if (removed) toast('Запись удалена', { label: 'Вернуть', fn: () => s.restoreFood(day, removed) });
              }}
            >
              <Icon name="trash" size={18} /> Удалить
            </button>
            <button
              className="btn"
              onClick={() => {
                s.updateFood(day, e.id, { ...m, meal, grams: per100 ? g : e.grams });
                haptic.success();
                onClose();
              }}
            >
              Сохранить
            </button>
          </div>
          <button
            className="btn ghost"
            onClick={() => {
              const to = dayKey();
              s.addFood(to, { name: e.name, emoji: e.emoji, grams: e.grams, foodId: e.foodId, meal: defaultMeal(), kcal: e.kcal, p: e.p, f: e.f, c: e.c });
              haptic.success();
              toast(day === to ? 'Добавил ещё раз' : 'Добавил на сегодня');
              onClose();
            }}
          >
            <Icon name="copy" size={18} /> {day === dayKey() ? 'Съел ещё раз' : 'Повторить сегодня'}
          </button>
        </div>
      )}
    </Sheet>
  );
}

export function yesterdayOf(day: string) {
  return addDays(day, -1);
}
