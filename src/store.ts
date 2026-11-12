import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { dayKey } from './lib/date';

/* ===================== Типы ===================== */

export type Sex = 'm' | 'f';
export type GoalType = 'lose' | 'keep' | 'gain';
export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface Profile {
  name: string;
  sex: Sex;
  age: number;
  height: number; // см
  weight: number; // кг, стартовый
  activity: number; // коэффициент 1.2…1.9
  goal: GoalType;
  pace: number; // кг в неделю
  targetWeight: number;
  sleepGoal: number; // часов
  wakeTime: string; // "07:00"
  stepGoal: number;
  waterGoal: number | null; // мл, null = авто
  kcalOverride: number | null;
  addActivity: boolean; // добавлять калории от шагов к норме
  glass: number; // объём стакана, мл
}

export interface Macros {
  kcal: number;
  p: number;
  f: number;
  c: number;
}

export interface FoodEntry extends Macros {
  id: string;
  meal: Meal;
  name: string;
  emoji: string;
  grams?: number;
  foodId?: string;
  time: number;
}

export interface Food extends Macros {
  // на 100 г
  id: string;
  name: string;
  emoji: string;
  unit?: { name: string; grams: number };
  custom?: boolean;
  cat?: string;
  brand?: string;
}

export interface TemplateItem extends Macros {
  name: string;
  emoji: string;
  grams?: number;
  foodId?: string;
}

export interface Template {
  id: string;
  name: string;
  emoji: string;
  items: TemplateItem[];
}

export interface SleepEntry {
  id: string;
  start: number;
  end: number;
  quality: number; // 0 — без оценки, 1…5
  nap?: boolean; // дневной сон
}

export interface Habit {
  id: string;
  name: string;
  emoji: string;
  color: string;
  days: number[]; // 0 = Пн
  target: number;
  unit: string;
  createdAt: number;
  archived?: boolean;
}

export interface GoalStep {
  id: string;
  text: string;
  done: boolean;
}

export interface Goal {
  id: string;
  title: string;
  emoji: string;
  kind: 'checklist' | 'weight' | 'number';
  deadline?: string;
  steps: GoalStep[];
  start?: number;
  target?: number;
  current?: number;
  unit?: string;
  done: boolean;
  doneAt?: number;
  createdAt: number;
}

export interface Fast {
  start: number;
  end: number;
  goal: number; // часов
}

/* ---------- финансы ---------- */

export interface Txn {
  id: string;
  type: 'exp' | 'inc';
  amount: number;
  cat: string;
  note?: string;
  day: string;
  time: number;
}

/** Копилка */
export interface Pot {
  id: string;
  name: string;
  emoji: string;
  target: number;
  saved: number;
  deadline?: string;
  createdAt: number;
}

/** Регулярный платёж (подписка, аренда, кредит) */
export interface Sub {
  id: string;
  name: string;
  emoji: string;
  amount: number;
  dom: number; // день месяца
  cat: string;
  lastPaid?: string; // YYYY-MM
}

export interface FinCat {
  id: string;
  label: string;
  emoji: string;
  type: 'exp' | 'inc';
  color: string;
}

export interface Fin {
  currency: string;
  budget: number | null; // лимит расходов на месяц
  catBudgets: Record<string, number>;
  customCats: FinCat[];
}

export interface Data {
  onboarded: boolean;
  profile: Profile;
  food: Record<string, FoodEntry[]>;
  customFoods: Food[];
  favorites: string[];
  templates: Template[];
  water: Record<string, number>;
  steps: Record<string, number>;
  weights: Record<string, number>;
  mood: Record<string, number>;
  sleeps: SleepEntry[];
  sleepStart: number | null;
  habits: Habit[];
  habitLog: Record<string, Record<string, number>>;
  goals: Goal[];
  fastStart: number | null;
  fastGoal: number;
  fasts: Fast[];
  sleepKind: 'night' | 'nap';
  napTarget: number | null; // минут, для таймера дневного сна
  txns: Txn[];
  pots: Pot[];
  subs: Sub[];
  fin: Fin;
}

export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

export const defaultProfile: Profile = {
  name: '',
  sex: 'm',
  age: 25,
  height: 178,
  weight: 75,
  activity: 1.375,
  goal: 'lose',
  pace: 0.5,
  targetWeight: 70,
  sleepGoal: 8,
  wakeTime: '07:00',
  stepGoal: 10000,
  waterGoal: null,
  kcalOverride: null,
  addActivity: false,
  glass: 250,
};

const initialData: Data = {
  onboarded: false,
  profile: defaultProfile,
  food: {},
  customFoods: [],
  favorites: [],
  templates: [],
  water: {},
  steps: {},
  weights: {},
  mood: {},
  sleeps: [],
  sleepStart: null,
  habits: [],
  habitLog: {},
  goals: [],
  fastStart: null,
  fastGoal: 16,
  fasts: [],
  sleepKind: 'night',
  napTarget: null,
  txns: [],
  pots: [],
  subs: [],
  fin: { currency: '₽', budget: null, catBudgets: {}, customCats: [] },
};

/* ===================== Действия ===================== */

interface Actions {
  completeOnboarding: (p: Profile, habits: Omit<Habit, 'id' | 'createdAt'>[]) => void;
  updateProfile: (p: Partial<Profile>) => void;

  addFood: (day: string, e: Omit<FoodEntry, 'id' | 'time'>) => void;
  restoreFood: (day: string, e: FoodEntry) => void;
  updateFood: (day: string, id: string, patch: Partial<FoodEntry>) => void;
  removeFood: (day: string, id: string) => FoodEntry | undefined;
  copyMeal: (from: string, to: string, meal: Meal) => number;
  addCustomFood: (f: Omit<Food, 'id' | 'custom'>) => string;
  removeCustomFood: (id: string) => void;
  toggleFavorite: (id: string) => void;
  saveFood: (f: Food) => void;
  saveTemplate: (name: string, emoji: string, items: TemplateItem[]) => void;
  removeTemplate: (id: string) => void;
  applyTemplate: (day: string, meal: Meal, id: string) => void;

  addWater: (day: string, ml: number) => void;
  setSteps: (day: string, n: number) => void;
  setWeight: (day: string, kg: number) => void;
  removeWeight: (day: string) => void;
  setMood: (day: string, v: number) => void;

  startSleep: (at?: number, kind?: 'night' | 'nap', target?: number | null) => void;
  cancelSleep: () => void;
  endSleep: (at?: number) => string | null;
  addSleep: (e: Omit<SleepEntry, 'id'>) => string;
  updateSleep: (id: string, patch: Partial<SleepEntry>) => void;
  removeSleep: (id: string) => SleepEntry | undefined;

  addHabit: (h: Omit<Habit, 'id' | 'createdAt'>) => void;
  updateHabit: (id: string, patch: Partial<Habit>) => void;
  removeHabit: (id: string) => void;
  setHabitCount: (day: string, id: string, n: number) => void;

  addGoal: (g: Omit<Goal, 'id' | 'createdAt' | 'done'>) => void;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  removeGoal: (id: string) => void;
  toggleGoalStep: (gid: string, sid: string) => void;
  addGoalStep: (gid: string, text: string) => void;
  removeGoalStep: (gid: string, sid: string) => void;

  startFast: (hours: number, at?: number) => void;
  endFast: () => Fast | null;
  cancelFast: () => void;

  addTxn: (t: Omit<Txn, 'id' | 'time'>) => string;
  updateTxn: (id: string, patch: Partial<Txn>) => void;
  removeTxn: (id: string) => Txn | undefined;
  restoreTxn: (t: Txn) => void;
  addPot: (p: Omit<Pot, 'id' | 'createdAt' | 'saved'>) => void;
  updatePot: (id: string, patch: Partial<Pot>) => void;
  removePot: (id: string) => void;
  movePot: (id: string, delta: number) => void;
  addSub: (s: Omit<Sub, 'id'>) => void;
  updateSub: (id: string, patch: Partial<Sub>) => void;
  removeSub: (id: string) => void;
  paySub: (id: string, day: string) => void;
  setFin: (patch: Partial<Fin>) => void;
  setCatBudget: (cat: string, limit: number | null) => void;
  addFinCat: (c: Omit<FinCat, 'id'>) => string;
  removeFinCat: (id: string) => void;

  importData: (d: Partial<Data>) => void;
  resetAll: () => void;
}

export type State = Data & Actions;

export const useStore = create<State>()(
  persist(
    immer((set, get) => ({
      ...initialData,

      completeOnboarding: (p, habits) =>
        set((s) => {
          s.profile = p;
          s.onboarded = true;
          s.weights[dayKey()] = p.weight;
          const now = Date.now();
          habits.forEach((h, i) => s.habits.push({ ...h, id: uid(), createdAt: now + i }));
        }),
      updateProfile: (p) => set((s) => void Object.assign(s.profile, p)),

      /* --- еда --- */
      addFood: (day, e) =>
        set((s) => {
          (s.food[day] ??= []).push({ ...e, id: uid(), time: Date.now() });
        }),
      restoreFood: (day, e) =>
        set((s) => {
          (s.food[day] ??= []).push(e);
        }),
      updateFood: (day, id, patch) =>
        set((s) => {
          const it = s.food[day]?.find((x) => x.id === id);
          if (it) Object.assign(it, patch);
        }),
      removeFood: (day, id) => {
        const it = get().food[day]?.find((x) => x.id === id);
        set((s) => {
          s.food[day] = (s.food[day] ?? []).filter((x) => x.id !== id);
        });
        return it ? { ...it } : undefined;
      },
      copyMeal: (from, to, meal) => {
        const items = (get().food[from] ?? []).filter((x) => x.meal === meal);
        set((s) => {
          const arr = (s.food[to] ??= []);
          items.forEach((x) => arr.push({ ...x, id: uid(), time: Date.now() }));
        });
        return items.length;
      },
      addCustomFood: (f) => {
        const id = 'c_' + uid();
        set((s) => {
          s.customFoods.unshift({ ...f, id, custom: true });
        });
        return id;
      },
      removeCustomFood: (id) =>
        set((s) => {
          s.customFoods = s.customFoods.filter((f) => f.id !== id);
          s.favorites = s.favorites.filter((f) => f !== id);
        }),
      toggleFavorite: (id) =>
        set((s) => {
          s.favorites = s.favorites.includes(id) ? s.favorites.filter((x) => x !== id) : [id, ...s.favorites];
        }),
      saveFood: (f) =>
        set((s) => {
          // товар из онлайн-базы сохраняем к себе, чтобы он остался в избранном
          if (!s.customFoods.some((x) => x.id === f.id)) s.customFoods.unshift({ ...f, custom: true });
          if (!s.favorites.includes(f.id)) s.favorites.unshift(f.id);
        }),
      saveTemplate: (name, emoji, items) =>
        set((s) => {
          s.templates.unshift({ id: uid(), name, emoji, items });
        }),
      removeTemplate: (id) =>
        set((s) => {
          s.templates = s.templates.filter((t) => t.id !== id);
        }),
      applyTemplate: (day, meal, id) =>
        set((s) => {
          const t = s.templates.find((x) => x.id === id);
          if (!t) return;
          const arr = (s.food[day] ??= []);
          t.items.forEach((it) => arr.push({ ...it, meal, id: uid(), time: Date.now() }));
        }),

      /* --- вода, шаги, вес, настроение --- */
      addWater: (day, ml) =>
        set((s) => {
          s.water[day] = Math.max(0, (s.water[day] ?? 0) + ml);
        }),
      setSteps: (day, n) =>
        set((s) => {
          s.steps[day] = Math.max(0, Math.round(n));
        }),
      setWeight: (day, kg) =>
        set((s) => {
          s.weights[day] = Math.round(kg * 10) / 10;
        }),
      removeWeight: (day) =>
        set((s) => {
          delete s.weights[day];
        }),
      setMood: (day, v) =>
        set((s) => {
          if (s.mood[day] === v) delete s.mood[day];
          else s.mood[day] = v;
        }),

      /* --- сон --- */
      startSleep: (at, kind = 'night', target = null) =>
        set((s) => {
          s.sleepStart = at ?? Date.now();
          s.sleepKind = kind;
          s.napTarget = kind === 'nap' ? target : null;
        }),
      cancelSleep: () =>
        set((s) => {
          s.sleepStart = null;
          s.sleepKind = 'night';
          s.napTarget = null;
        }),
      endSleep: (at) => {
        const start = get().sleepStart;
        if (!start) return null;
        const end = at ?? Date.now();
        const id = uid();
        const nap = get().sleepKind === 'nap';
        set((s) => {
          s.sleepStart = null;
          s.sleepKind = 'night';
          s.napTarget = null;
          if (end - start > 5 * 60_000) s.sleeps.push({ id, start, end, quality: 0, nap });
        });
        return end - start > 5 * 60_000 ? id : null;
      },
      addSleep: (e) => {
        const id = uid();
        set((s) => {
          s.sleeps.push({ ...e, id });
        });
        return id;
      },
      updateSleep: (id, patch) =>
        set((s) => {
          const it = s.sleeps.find((x) => x.id === id);
          if (it) Object.assign(it, patch);
        }),
      removeSleep: (id) => {
        const it = get().sleeps.find((x) => x.id === id);
        set((s) => {
          s.sleeps = s.sleeps.filter((x) => x.id !== id);
        });
        return it ? { ...it } : undefined;
      },

      /* --- привычки --- */
      addHabit: (h) =>
        set((s) => {
          s.habits.push({ ...h, id: uid(), createdAt: Date.now() });
        }),
      updateHabit: (id, patch) =>
        set((s) => {
          const it = s.habits.find((x) => x.id === id);
          if (it) Object.assign(it, patch);
        }),
      removeHabit: (id) =>
        set((s) => {
          s.habits = s.habits.filter((x) => x.id !== id);
        }),
      setHabitCount: (day, id, n) =>
        set((s) => {
          const d = (s.habitLog[day] ??= {});
          if (n <= 0) delete d[id];
          else d[id] = n;
        }),

      /* --- цели --- */
      addGoal: (g) =>
        set((s) => {
          s.goals.unshift({ ...g, id: uid(), createdAt: Date.now(), done: false });
        }),
      updateGoal: (id, patch) =>
        set((s) => {
          const it = s.goals.find((x) => x.id === id);
          if (it) Object.assign(it, patch);
        }),
      removeGoal: (id) =>
        set((s) => {
          s.goals = s.goals.filter((x) => x.id !== id);
        }),
      toggleGoalStep: (gid, sid) =>
        set((s) => {
          const st = s.goals.find((x) => x.id === gid)?.steps.find((x) => x.id === sid);
          if (st) st.done = !st.done;
        }),
      addGoalStep: (gid, text) =>
        set((s) => {
          s.goals.find((x) => x.id === gid)?.steps.push({ id: uid(), text, done: false });
        }),
      removeGoalStep: (gid, sid) =>
        set((s) => {
          const g = s.goals.find((x) => x.id === gid);
          if (g) g.steps = g.steps.filter((x) => x.id !== sid);
        }),

      /* --- голодание --- */
      startFast: (hours, at) =>
        set((s) => {
          s.fastStart = at ?? Date.now();
          s.fastGoal = hours;
        }),
      endFast: () => {
        const { fastStart, fastGoal } = get();
        if (!fastStart) return null;
        const f: Fast = { start: fastStart, end: Date.now(), goal: fastGoal };
        set((s) => {
          s.fastStart = null;
          if (f.end - f.start > 30 * 60_000) s.fasts.push(f);
        });
        return f;
      },
      cancelFast: () =>
        set((s) => {
          s.fastStart = null;
        }),

      /* --- финансы --- */
      addTxn: (t) => {
        const id = uid();
        set((s) => {
          s.txns.push({ ...t, amount: Math.round(t.amount * 100) / 100, id, time: Date.now() });
        });
        return id;
      },
      updateTxn: (id, patch) =>
        set((s) => {
          const it = s.txns.find((x) => x.id === id);
          if (it) Object.assign(it, patch);
        }),
      removeTxn: (id) => {
        const it = get().txns.find((x) => x.id === id);
        set((s) => {
          s.txns = s.txns.filter((x) => x.id !== id);
        });
        return it ? { ...it } : undefined;
      },
      restoreTxn: (t) =>
        set((s) => {
          s.txns.push(t);
        }),
      addPot: (p) =>
        set((s) => {
          s.pots.push({ ...p, id: uid(), saved: 0, createdAt: Date.now() });
        }),
      updatePot: (id, patch) =>
        set((s) => {
          const it = s.pots.find((x) => x.id === id);
          if (it) Object.assign(it, patch);
        }),
      removePot: (id) =>
        set((s) => {
          s.pots = s.pots.filter((x) => x.id !== id);
        }),
      movePot: (id, delta) =>
        set((s) => {
          const it = s.pots.find((x) => x.id === id);
          if (it) it.saved = Math.max(0, Math.round((it.saved + delta) * 100) / 100);
        }),
      addSub: (sub) =>
        set((s) => {
          s.subs.push({ ...sub, id: uid() });
        }),
      updateSub: (id, patch) =>
        set((s) => {
          const it = s.subs.find((x) => x.id === id);
          if (it) Object.assign(it, patch);
        }),
      removeSub: (id) =>
        set((s) => {
          s.subs = s.subs.filter((x) => x.id !== id);
        }),
      paySub: (id, day) =>
        set((s) => {
          const it = s.subs.find((x) => x.id === id);
          if (!it) return;
          it.lastPaid = day.slice(0, 7);
          s.txns.push({ id: uid(), type: 'exp', amount: it.amount, cat: it.cat, note: it.name, day, time: Date.now() });
        }),
      setFin: (patch) => set((s) => void Object.assign(s.fin, patch)),
      setCatBudget: (cat, limit) =>
        set((s) => {
          if (limit && limit > 0) s.fin.catBudgets[cat] = limit;
          else delete s.fin.catBudgets[cat];
        }),
      addFinCat: (c) => {
        const id = 'u_' + uid();
        set((s) => {
          s.fin.customCats.push({ ...c, id });
        });
        return id;
      },
      removeFinCat: (id) =>
        set((s) => {
          s.fin.customCats = s.fin.customCats.filter((c) => c.id !== id);
        }),

      importData: (d) => set(() => ({ ...initialData, ...d, fin: { ...initialData.fin, ...(d.fin ?? {}) } })),
      resetAll: () => set(() => ({ ...initialData })),
    })),
    { name: 'ritm-v1', version: 1 },
  ),
);

/** Только данные (без функций) — для экспорта и облака */
export function pickData(s: State): Data {
  const out = {} as Record<string, unknown>;
  (Object.keys(initialData) as (keyof Data)[]).forEach((k) => (out[k] = s[k]));
  return out as unknown as Data;
}
