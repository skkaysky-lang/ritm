import type { Data } from '../store';
import { bedMinutes, currentWeight, dayHabitProgress, dayScore, dayTargets, fmtNum, habitBestStreak, isNap, linearSlope, nightsByDay, sleepStats, sumMacros } from './calc';
import { addMonths, curMonth, fmtMoney, monthStats, trackedFromStart } from './money';
import { addDays, dayKey, daysBetween, fmtDur, fmtMinutesOfDay, lastDays } from './date';

export interface Insight {
  emoji: string;
  title: string;
  text: string;
  tone: 'good' | 'warn' | 'info';
}

export function insights(d: Data): Insight[] {
  const out: Insight[] = [];
  const goalMin = d.profile.sleepGoal * 60;
  const st = sleepStats(d, 7);
  const nights = nightsByDay(d.sleeps);

  if (st.nights >= 3) {
    const diff = st.avg - goalMin;
    out.push(
      diff >= -20
        ? { emoji: '😴', title: 'Сон в норме', text: `В среднем ${fmtDur(st.avg)} за ночь, цель выполняется. Так держать!`, tone: 'good' }
        : { emoji: '🥱', title: 'Недосып', text: `В среднем ${fmtDur(st.avg)}, это на ${fmtDur(-diff)} меньше цели. Недосып за неделю: ${fmtDur(st.debt)}.`, tone: 'warn' },
    );
    if (st.consistency && st.consistency < 60 && st.avgBed != null)
      out.push({ emoji: '🕰️', title: 'Режим скачет', text: `Время отбоя сильно гуляет. Попробуй ложиться около ${fmtMinutesOfDay(st.avgBed)} каждый день, даже в выходные.`, tone: 'warn' });
    else if (st.consistency >= 80) out.push({ emoji: '🎯', title: 'Стабильный режим', text: `Регулярность ${st.consistency}%. Организм любит постоянство.`, tone: 'good' });
  }

  // Связь сна и привычек
  const days = lastDays(30).filter((k) => nights[k]?.main && dayHabitProgress(d, k).total > 0);
  if (days.length >= 6) {
    const rate = (ks: string[]) => {
      const t = ks.reduce((a, k) => a + dayHabitProgress(d, k).total, 0);
      return t ? ks.reduce((a, k) => a + dayHabitProgress(d, k).done, 0) / t : 0;
    };
    const good = days.filter((k) => nights[k].total >= goalMin - 30);
    const bad = days.filter((k) => nights[k].total < goalMin - 30);
    if (good.length >= 2 && bad.length >= 2) {
      const g = rate(good);
      const b = rate(bad);
      const diff = Math.round((g - b) * 100);
      if (Math.abs(diff) >= 10)
        out.push({
          emoji: '🔗',
          title: 'Сон влияет на привычки',
          text: diff > 0 ? `Когда высыпаешься, выполняешь на ${diff}% больше привычек. Сон — твоя суперсила.` : `Интересно: в дни недосыпа ты выполняешь привычки даже лучше (на ${-diff}%).`,
          tone: 'info',
        });
    }
  }

  // Питание
  const fed = lastDays(7, addDays(dayKey(), -1)).filter((k) => (d.food[k] ?? []).length >= 2);
  if (fed.length >= 3) {
    const avg = fed.reduce((a, k) => a + sumMacros(d.food[k]).kcal, 0) / fed.length;
    const avgP = fed.reduce((a, k) => a + sumMacros(d.food[k]).p, 0) / fed.length;
    const t = dayTargets(d, dayKey());
    const ratio = avg / t.kcal;
    if (ratio > 1.1) out.push({ emoji: '🍕', title: 'Перебор калорий', text: `В среднем ${fmtNum(avg)} ккал при норме ${fmtNum(t.kcal)}. Проверь перекусы и напитки.`, tone: 'warn' });
    else if (ratio < 0.75) out.push({ emoji: '⚠️', title: 'Слишком мало еды', text: `В среднем ${fmtNum(avg)} ккал: это сильно ниже нормы. Так легко сорваться и потерять мышцы.`, tone: 'warn' });
    else out.push({ emoji: '🥗', title: 'Калории под контролем', text: `В среднем ${fmtNum(avg)} ккал из ${fmtNum(t.kcal)}. Отличный баланс.`, tone: 'good' });
    if (avgP < t.p * 0.75) out.push({ emoji: '🥩', title: 'Мало белка', text: `В среднем ${Math.round(avgP)} г из ${t.p} г. Добавь творог, яйца, курицу или рыбу.`, tone: 'warn' });
  }

  // Шаги
  const stepDays = lastDays(7).filter((k) => (d.steps[k] ?? 0) > 0);
  if (stepDays.length >= 3) {
    const avg = stepDays.reduce((a, k) => a + d.steps[k], 0) / stepDays.length;
    out.push(
      avg >= d.profile.stepGoal
        ? { emoji: '👟', title: 'Много ходишь', text: `В среднем ${fmtNum(avg)} шагов в день. Выше цели!`, tone: 'good' }
        : { emoji: '🚶', title: 'Больше движения', text: `В среднем ${fmtNum(avg)} шагов. До цели не хватает ~${fmtNum(d.profile.stepGoal - avg)}: это примерно ${Math.round((d.profile.stepGoal - avg) / 100)} минут прогулки.`, tone: 'info' },
    );
  }

  // Вес
  const wk = Object.keys(d.weights)
    .sort()
    .filter((k) => daysBetween(k, dayKey()) <= 28);
  if (wk.length >= 3 && daysBetween(wk[0], wk[wk.length - 1]) >= 6) {
    const slope = linearSlope(wk.map((k) => ({ x: daysBetween(wk[0], k), y: d.weights[k] }))) * 7;
    const s = Math.abs(slope).toFixed(2).replace('.', ',');
    const goal = d.profile.goal;
    const ok = (goal === 'lose' && slope < -0.1) || (goal === 'gain' && slope > 0.1) || (goal === 'keep' && Math.abs(slope) < 0.25);
    out.push({
      emoji: ok ? '📈' : '🤔',
      title: slope < -0.05 ? `Минус ${s} кг в неделю` : slope > 0.05 ? `Плюс ${s} кг в неделю` : 'Вес стабилен',
      text: ok ? 'Двигаешься к цели в хорошем темпе.' : goal === 'lose' ? 'Вес стоит или растёт. Проверь, точно ли все приёмы пищи записаны.' : 'Тренд пока не совпадает с целью. Посмотри на калории.',
      tone: ok ? 'good' : 'warn',
    });
  }

  // Дневной сон: сдвигает ли он отбой
  {
    const withNap: number[] = [];
    const noNap: number[] = [];
    for (const k of lastDays(30)) {
      const m = nights[k]?.main;
      if (!m) continue;
      (nights[addDays(k, -1)]?.nap ? withNap : noNap).push(bedMinutes(m.start));
    }
    if (withNap.length >= 3 && noNap.length >= 3) {
      const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
      const shift = Math.round(avg(withNap) - avg(noNap));
      if (shift >= 20) out.push({ emoji: '😴', title: 'Дневной сон сдвигает отбой', text: `После дневного сна ты ложишься в среднем на ${shift} мин позже. Попробуй спать днём не дольше 20–30 минут и до 15:00.`, tone: 'info' });
      else if (shift <= 5) out.push({ emoji: '😴', title: 'Дневной сон тебе подходит', text: 'Он не сдвигает ночной отбой. Можно спокойно добирать сон днём.', tone: 'good' });
    }
  }

  // Настроение и сон
  {
    const good: number[] = [];
    const bad: number[] = [];
    for (const k of lastDays(30)) {
      const mood = d.mood[k];
      if (mood == null || !nights[k]?.main) continue;
      (nights[k].total >= goalMin - 30 ? good : bad).push(mood);
    }
    if (good.length >= 3 && bad.length >= 3) {
      const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
      const diff = avg(good) - avg(bad);
      if (diff >= 0.4) out.push({ emoji: '🙂', title: 'Высыпаешься — и настроение лучше', text: `В дни после нормального сна настроение в среднем ${avg(good).toFixed(1).replace('.', ',')} из 5, после недосыпа — ${avg(bad).toFixed(1).replace('.', ',')}.`, tone: 'info' });
    }
  }

  // Деньги
  {
    const cur = d.fin.currency;
    const ms = monthStats(d, curMonth());
    if (ms.count >= 5 && ms.exp > 0) {
      const top = ms.byCat[0];
      if (top && top.share >= 0.25 && ms.byCat.length > 1)
        out.push({ emoji: top.cat.emoji, title: `${top.cat.label}: ${Math.round(top.share * 100)}% расходов`, text: `На эту категорию ушло ${fmtMoney(top.sum, cur)} в этом месяце. Здесь проще всего найти, на чём сэкономить.`, tone: 'info' });
      if (d.fin.budget && ms.daysPassed >= 5) {
        if (ms.forecast > d.fin.budget * 1.05)
          out.push({ emoji: '💸', title: 'Бюджет под угрозой', text: `При таком темпе к концу месяца потратишь около ${fmtMoney(Math.round(ms.forecast), cur)}: это на ${fmtMoney(Math.round(ms.forecast - d.fin.budget), cur)} больше бюджета.`, tone: 'warn' });
        else out.push({ emoji: '💰', title: 'Укладываешься в бюджет', text: `Прогноз на месяц: ${fmtMoney(Math.round(ms.forecast), cur)} из ${fmtMoney(d.fin.budget, cur)}.`, tone: 'good' });
      }
      const prev = monthStats(d, addMonths(curMonth(), -1));
      if (prev.exp > 0 && ms.daysPassed >= 10 && trackedFromStart(d, addMonths(curMonth(), -1))) {
        const diff = (ms.forecast - prev.exp) / prev.exp;
        if (diff <= -0.1) out.push({ emoji: '📉', title: 'Тратишь меньше', text: `Расходы идут на ${Math.round(-diff * 100)}% ниже прошлого месяца. Разницу можно отправить в копилку.`, tone: 'good' });
      }
    }
  }

  if (!out.length) out.push({ emoji: '🌱', title: 'Собираю данные', text: 'Отмечай сон, еду и привычки несколько дней, и здесь появятся персональные выводы.', tone: 'info' });
  return out;
}

const TIPS = [
  ['💧', 'Стакан воды сразу после пробуждения помогает проснуться и запускает обмен веществ.'],
  ['🌙', 'Убери телефон за 30 минут до сна: синий свет мешает выработке мелатонина.'],
  ['🥩', 'Белок в каждом приёме пищи дольше держит сытость и бережёт мышцы на дефиците.'],
  ['🚶', '10 минут прогулки после еды снижают скачок сахара в крови.'],
  ['☀️', 'Утренний свет в первые полчаса после подъёма настраивает внутренние часы.'],
  ['🧠', 'Новую привычку проще прикрепить к старой: «после того как почищу зубы — 5 минут растяжки».'],
  ['🍽️', 'Ешь медленно: сигнал сытости доходит до мозга примерно через 20 минут.'],
  ['📝', 'Записывай еду сразу, а не вечером: так точнее и не забудешь перекусы.'],
  ['🛏️', 'Прохладная спальня (18–20 °C) помогает быстрее уснуть и спать глубже.'],
  ['🎯', 'Не идеальность, а постоянство: пропустил день — просто не пропускай второй.'],
  ['☕', 'Кофеин держится в крови 5–6 часов. Последняя чашка — до 14–15 часов.'],
  ['🥦', 'Половина тарелки овощей — простой способ съесть меньше калорий без голода.'],
  ['⚖️', 'Вес колеблется на 0,5–1,5 кг за день из-за воды. Смотри на тренд за неделю.'],
  ['😮‍💨', 'Не можешь уснуть? Дыхание 4-7-8: вдох на 4, задержка на 7, выдох на 8.'],
];

export function tipOfDay(): { emoji: string; text: string } {
  const n = Math.floor(Date.now() / 86_400_000);
  const [emoji, text] = TIPS[n % TIPS.length];
  return { emoji, text };
}

/* ===================== Достижения ===================== */

export interface Achievement {
  id: string;
  emoji: string;
  name: string;
  desc: string;
  progress: number;
  done: boolean;
}

export function achievements(d: Data): Achievement[] {
  const nights = nightsByDay(d.sleeps);
  const nightKeys = Object.keys(nights).sort();
  const goal = d.profile.sleepGoal * 60;
  let sleepStreak = 0;
  let best = 0;
  for (const k of nightKeys) {
    if (!nights[k].main) continue;
    if (nights[k].total >= goal - 15) best = Math.max(best, ++sleepStreak);
    else sleepStreak = 0;
  }
  const foodDays = Object.keys(d.food).filter((k) => d.food[k].length > 0).length;
  const inTarget = Object.keys(d.food).filter((k) => {
    const sum = sumMacros(d.food[k]).kcal;
    const t = dayTargets(d, k).kcal;
    return d.food[k].length >= 2 && Math.abs(sum - t) / t <= 0.1;
  }).length;
  const t = dayTargets(d, dayKey());
  const waterDays = Object.keys(d.water).filter((k) => d.water[k] >= t.water).length;
  const maxSteps = Math.max(0, ...Object.values(d.steps));
  const totalSteps = Object.values(d.steps).reduce((a, b) => a + b, 0);
  const habitBest = Math.max(0, ...d.habits.map((h) => habitBestStreak(d, h)));
  const goalsDone = d.goals.filter((g) => g.done).length;
  const startW = d.profile.weight;
  const lost = startW - currentWeight(d);
  const fasts = d.fasts.filter((f) => f.end - f.start >= f.goal * 3_600_000).length;
  const perfectDays = Object.keys(d.habitLog).filter((k) => {
    const p = dayHabitProgress(d, k);
    return p.total > 0 && p.done === p.total;
  }).length;

  const a = (id: string, emoji: string, name: string, desc: string, cur: number, need: number): Achievement => ({
    id,
    emoji,
    name,
    desc,
    progress: Math.min(1, cur / need),
    done: cur >= need,
  });

  const list = [
    a('sleep1', '🌙', 'Первая ночь', 'Записать первый сон', d.sleeps.length, 1),
    a('sleep7', '🛌', 'Неделя сна', 'Записать 7 ночей', nightKeys.filter((k) => nights[k].main).length, 7),
    a('sleepstreak', '👑', 'Король сна', '5 ночей подряд в норме', best, 5),
    a('food1', '🍽️', 'Первый приём', 'Записать еду', foodDays, 1),
    a('food7', '📒', 'Дневник питания', 'Вести дневник 7 дней', foodDays, 7),
    a('target7', '🎯', 'Снайпер', '7 дней в норме калорий ±10%', inTarget, 7),
    a('water', '💧', 'Водный баланс', 'Норма воды 5 дней', waterDays, 5),
    a('steps10', '👟', '10 000', '10 000 шагов за день', maxSteps, 10000),
    a('steps20', '🏃', 'Марафонец', '20 000 шагов за день', maxSteps, 20000),
    a('steps500', '🌍', 'Путешественник', '500 000 шагов всего', totalSteps, 500000),
    a('habit7', '🔥', 'Неделя огня', 'Серия привычки 7 дней', habitBest, 7),
    a('habit21', '💎', '21 день', 'Серия 21 день: привычка закрепляется', habitBest, 21),
    a('habit66', '🏆', 'Автопилот', 'Серия 66 дней', habitBest, 66),
    a('perfect', '⭐', 'Идеальный день', 'Выполнить все привычки за день', perfectDays, 1),
    a('perfect10', '🌟', 'Десятка', '10 идеальных дней', perfectDays, 10),
    a('goal1', '🚀', 'Цель взята', 'Выполнить первую цель', goalsDone, 1),
    a('fast', '⏳', 'Выдержка', 'Завершить голодание по плану', fasts, 1),
  ];
  // финансы, дневной сон, индекс дня
  const pastBudgetOk = d.fin.budget
    ? [1, 2, 3, 4, 5, 6].some((n) => {
        const ms = monthStats(d, addMonths(curMonth(), -n));
        return ms.exp > 0 && ms.exp <= d.fin.budget!;
      })
    : false;
  const nowMs = monthStats(d, curMonth());
  const bestScore = Math.max(0, ...lastDays(45).map((k) => dayScore(d, k).score));
  list.push(
    a('money1', '💸', 'Первая трата', 'Записать первую операцию', d.txns.length, 1),
    a('money30', '🧾', 'Бухгалтер', 'Записать 30 операций', d.txns.length, 30),
    a('nospend', '🧘', 'Дзен', '5 дней без трат за месяц', nowMs.count ? nowMs.noSpendDays : 0, 5),
    a('budget', '🎯', 'В бюджете', 'Закончить месяц в рамках бюджета', pastBudgetOk ? 1 : 0, 1),
    a('pot', '🐷', 'Копилка полна', 'Собрать копилку целиком', d.pots.some((p) => p.saved >= p.target) ? 1 : 0, 1),
    a('nap5', '😴', 'Сиеста', '5 раз поспать днём', d.sleeps.filter(isNap).length, 5),
    a('score90', '🏅', 'День на 90+', 'Набрать индекс дня 90 и выше', bestScore, 90),
  );
  if (d.profile.goal === 'lose') {
    list.push(a('lose1', '📉', 'Минус 1', 'Сбросить 1 кг', Math.max(0, lost), 1));
    list.push(a('lose5', '🥇', 'Минус 5', 'Сбросить 5 кг', Math.max(0, lost), 5));
  } else if (d.profile.goal === 'gain') {
    list.push(a('gain1', '💪', 'Плюс 1', 'Набрать 1 кг', Math.max(0, -lost), 1));
  }
  return list;
}

/* Сжатая статистика за период */
export function periodSummary(d: Data, days: number) {
  const keys = lastDays(days);
  const nights = nightsByDay(d.sleeps);
  const sl = keys.filter((k) => nights[k]?.main);
  const fed = keys.filter((k) => (d.food[k] ?? []).length > 0 && k !== dayKey());
  const st = keys.filter((k) => (d.steps[k] ?? 0) > 0);
  const hab = keys.map((k) => dayHabitProgress(d, k)).filter((p) => p.total > 0);
  return {
    sleep: sl.length ? sl.reduce((a, k) => a + nights[k].total, 0) / sl.length : 0,
    kcal: fed.length ? fed.reduce((a, k) => a + sumMacros(d.food[k]).kcal, 0) / fed.length : 0,
    steps: st.length ? st.reduce((a, k) => a + d.steps[k], 0) / st.length : 0,
    habits: hab.length ? hab.reduce((a, p) => a + p.done, 0) / hab.reduce((a, p) => a + p.total, 0) : 0,
    hasData: sl.length + fed.length + st.length + hab.length > 0,
  };
}
