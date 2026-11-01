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
  saveTemplate: (name: string, emoji: string, items: TemplateItem[]) => void;
  removeTemplate: (id: string) => void;
  applyTemplate: (day: string, meal: Meal, id: string) => void;

  addWater: (day: string, ml: number) => void;
  setSteps: (day: string, n: number) => void;
  setWeight: (day: string, kg: number) => void;
  removeWeight: (day: string) => void;
  setMood: (day: string, v: number) => void;

  startSleep: (at?: number) => void;
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
      startSleep: (at) =>
        set((s) => {
          s.sleepStart = at ?? Date.now();
        }),
      cancelSleep: () =>
        set((s) => {
          s.sleepStart = null;
        }),
      endSleep: (at) => {
        const start = get().sleepStart;
        if (!start) return null;
        const end = at ?? Date.now();
        const id = uid();
        set((s) => {
          s.sleepStart = null;
          if (end - start > 5 * 60_000) s.sleeps.push({ id, start, end, quality: 0 });
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

      importData: (d) => set(() => ({ ...initialData, ...d })),
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
