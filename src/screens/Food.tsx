import { useState } from 'react';
import { useStore, type FoodEntry, type Meal } from '../store';
import { dayTargets, fmtNum, round1, sumMacros } from '../lib/calc';
import { addDays, dayKey, humanDay, lastDays, WD, weekday } from '../lib/date';
import { haptic } from '../lib/telegram';
import { Icon } from '../components/Icon';
import { Bars } from '../components/charts';
import { Bar, CountUp, DayStrip, Ring, Sheet, toast } from '../components/ui';
import { AddFoodSheet, FoodEntrySheet, MacroLine, MEALS } from '../components/FoodSheets';
import { FastingCard, WaterCard } from '../components/widgets';
import { NameSheet } from '../components/sheets';

export function FoodScreen() {
  const s = useStore();
  const [day, setDay] = useState(dayKey());
  const [adding, setAdding] = useState<Meal | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [entry, setEntry] = useState<FoodEntry | null>(null);
  const [menu, setMenu] = useState<Meal | null>(null);
  const [saveTpl, setSaveTpl] = useState<Meal | null>(null);

  const t = dayTargets(s, day);
  const list = s.food[day] ?? [];
  const tot = sumMacros(list);
  const left = t.kcal - tot.kcal;
  const macroKcal = tot.p * 4 + tot.f * 9 + tot.c * 4 || 1;

  const openAdd = (m: Meal) => {
    haptic.light();
    setAdding(m);
    setAddOpen(true);
  };

  return (
    <div className="screen stack">
      <div className="page-head">
        <div>
          <div className="page-title">Питание</div>
          <div className="page-sub">{humanDay(day)}</div>
        </div>
        {day !== dayKey() && (
          <button className="btn sm ghost" onClick={() => setDay(dayKey())}>
            Сегодня
          </button>
        )}
      </div>

      <DayStrip value={day} onChange={setDay} mark={(k) => sumMacros(s.food[k] ?? []).kcal / dayTargets(s, k).kcal} />

      {/* ---------- Итог дня ---------- */}
      <div className="card card-glow" style={{ ['--glow' as string]: 'var(--food)' }}>
        <div className="row" style={{ gap: 16 }}>
          <Ring value={tot.kcal / t.kcal} size={124} stroke={12} colors={left < 0 ? ['var(--bad)', 'var(--food-2)'] : ['var(--food)', 'var(--food-2)']}>
            <div className="tiny muted bold">{left >= 0 ? 'осталось' : 'перебор'}</div>
            <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.1 }} className="num">
              <CountUp value={Math.abs(left)} />
            </div>
            <div className="tiny muted bold">ккал</div>
          </Ring>
          <div className="grow stack-sm">
            <div className="row" style={{ gap: 14 }}>
              <div className="stat">
                <span className="v num" style={{ fontSize: 18 }}>
                  {fmtNum(tot.kcal)}
                </span>
                <span className="l">съедено</span>
              </div>
              <div className="stat">
                <span className="v num" style={{ fontSize: 18 }}>
                  {fmtNum(t.kcal)}
                </span>
                <span className="l">норма</span>
              </div>
            </div>
            {/* распределение калорий по БЖУ */}
            <div style={{ display: 'flex', height: 8, borderRadius: 5, overflow: 'hidden', background: 'var(--surface-3)' }}>
              {tot.kcal > 0 &&
                (
                  [
                    [tot.p * 4, 'var(--protein)'],
                    [tot.f * 9, 'var(--fat)'],
                    [tot.c * 4, 'var(--carbs)'],
                  ] as const
                ).map(([v, c], i) => <i key={i} style={{ width: `${(v / macroKcal) * 100}%`, background: c, transition: 'width .5s' }} />)}
            </div>
            <div className="tiny muted bold">
              {t.deficit > 0 ? `Дефицит ${fmtNum(t.deficit)} ккал от расхода ${fmtNum(t.tdee)}` : t.deficit < 0 ? `Профицит ${fmtNum(-t.deficit)} ккал` : `Поддержание: ${fmtNum(t.tdee)} ккал`}
            </div>
          </div>
        </div>
        <div className="grid-3" style={{ marginTop: 14 }}>
          {(
            [
              ['Белки', tot.p, t.p, 'var(--protein)'],
              ['Жиры', tot.f, t.f, 'var(--fat)'],
              ['Углеводы', tot.c, t.c, 'var(--carbs)'],
            ] as const
          ).map(([l, v, g, c]) => (
            <div key={l} className="stat-box">
              <div className="tiny muted bold">{l}</div>
              <div className="bold num" style={{ fontSize: 16, margin: '2px 0 6px' }}>
                {Math.round(v)}
                <span className="faint small">/{g}г</span>
              </div>
              <Bar value={v / g} color={c} className="thin" />
              <div className="tiny faint bold num" style={{ marginTop: 4 }}>
                {v > g ? `+${Math.round(v - g)} г` : `ещё ${Math.round(g - v)} г`}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ---------- Приёмы пищи ---------- */}
      {MEALS.map((m) => {
        const items = list.filter((x) => x.meal === m.id);
        const mt = sumMacros(items);
        return (
          <div key={m.id} className="card" style={{ paddingBottom: items.length ? 10 : 16 }}>
            <div className="row-between">
              <div className="row">
                <div className="emoji-box sm">{m.emoji}</div>
                <div>
                  <div className="bold">{m.label}</div>
                  <div className="tiny muted num">{items.length ? `${fmtNum(mt.kcal)} ккал · Б ${round1(mt.p)} Ж ${round1(mt.f)} У ${round1(mt.c)}` : 'ничего не добавлено'}</div>
                </div>
              </div>
              <div className="row" style={{ gap: 6 }}>
                <button className="icon-btn sm" onClick={() => (haptic.light(), setMenu(m.id))} aria-label="Ещё">
                  <Icon name="more" size={20} stroke={3} />
                </button>
                <button className="icon-btn sm" style={{ background: 'color-mix(in srgb, var(--food) 18%, transparent)', color: 'var(--food)' }} onClick={() => openAdd(m.id)} aria-label="Добавить">
                  <Icon name="plus" size={18} stroke={2.6} />
                </button>
              </div>
            </div>
            {items.length > 0 && (
              <div className="list" style={{ marginTop: 6 }}>
                {items.map((e) => (
                  <button key={e.id} className="list-item" onClick={() => (haptic.light(), setEntry(e))}>
                    <span style={{ fontSize: 20, width: 28, textAlign: 'center' }}>{e.emoji}</span>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="ellipsis" style={{ fontWeight: 600 }}>
                        {e.name}
                        {e.grams ? <span className="faint small"> · {Math.round(e.grams)} г</span> : null}
                      </div>
                      <MacroLine m={e} kcal={false} />
                    </div>
                    <span className="bold num">{Math.round(e.kcal)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <WaterCard day={day} />
      {day === dayKey() && <FastingCard />}

      {/* ---------- Неделя ---------- */}
      <div className="card stack">
        <div className="card-title">Калории за неделю</div>
        <Bars
          data={lastDays(7, day).map((k) => {
            const v = sumMacros(s.food[k] ?? []).kcal;
            const g = dayTargets(s, k).kcal;
            return {
              key: k,
              label: WD[weekday(k)],
              value: v,
              color: v === 0 ? undefined : v > g * 1.1 ? 'linear-gradient(180deg, #ff6b6b, #ff9f43)' : v < g * 0.75 ? 'linear-gradient(180deg, var(--carbs), #4f8bff)' : 'linear-gradient(180deg, var(--good), #19b3d6)',
            };
          })}
          goal={t.kcal}
          goalLabel="норма"
          format={(v) => `${fmtNum(v)} ккал`}
        />
        <div className="row tiny muted bold" style={{ gap: 12, flexWrap: 'wrap' }}>
          <span className="row" style={{ gap: 4 }}>
            <i className="dot" style={{ background: 'var(--good)' }} /> в норме
          </span>
          <span className="row" style={{ gap: 4 }}>
            <i className="dot" style={{ background: '#ff6b6b' }} /> перебор
          </span>
          <span className="row" style={{ gap: 4 }}>
            <i className="dot" style={{ background: 'var(--carbs)' }} /> мало
          </span>
        </div>
      </div>

      <AddFoodSheet open={addOpen} onClose={() => setAddOpen(false)} day={day} meal={adding ?? undefined} />
      <FoodEntrySheet entry={entry} day={day} onClose={() => setEntry(null)} />

      <Sheet open={!!menu} onClose={() => setMenu(null)} title={menu ? MEALS.find((x) => x.id === menu)!.label : ''}>
        {menu && (
          <div className="stack-sm">
            <button
              className="btn ghost"
              style={{ justifyContent: 'flex-start' }}
              onClick={() => {
                const n = s.copyMeal(addDays(day, -1), day, menu);
                haptic[n ? 'success' : 'warning']();
                toast(n ? `Скопировано: ${n} поз.` : 'Вчера в этом приёме было пусто');
                setMenu(null);
              }}
            >
              <Icon name="copy" size={18} /> Скопировать со вчера
            </button>
            <button
              className="btn ghost"
              style={{ justifyContent: 'flex-start' }}
              disabled={!list.some((x) => x.meal === menu)}
              onClick={() => {
                setSaveTpl(menu);
                setMenu(null);
              }}
            >
              <Icon name="bookmark" size={18} /> Сохранить как блюдо
            </button>
            <button
              className="btn danger"
              style={{ justifyContent: 'flex-start' }}
              disabled={!list.some((x) => x.meal === menu)}
              onClick={() => {
                const removed = list.filter((x) => x.meal === menu);
                removed.forEach((x) => s.removeFood(day, x.id));
                haptic.warning();
                toast('Приём очищен', { label: 'Вернуть', fn: () => removed.forEach((x) => useStore.getState().restoreFood(day, x)) });
                setMenu(null);
              }}
            >
              <Icon name="trash" size={18} /> Очистить
            </button>
          </div>
        )}
      </Sheet>

      <NameSheet
        open={!!saveTpl}
        title="Сохранить как блюдо"
        emoji={saveTpl ? MEALS.find((x) => x.id === saveTpl)!.emoji : undefined}
        initial={saveTpl ? `Мой ${MEALS.find((x) => x.id === saveTpl)!.label.toLowerCase()}` : ''}
        onClose={() => setSaveTpl(null)}
        onSave={(name) => {
          const items = list.filter((x) => x.meal === saveTpl).map(({ name, emoji, grams, foodId, kcal, p, f, c }) => ({ name, emoji, grams, foodId, kcal, p, f, c }));
          s.saveTemplate(name, MEALS.find((x) => x.id === saveTpl)!.emoji, items);
          haptic.success();
          toast('Блюдо сохранено. Ищи его во вкладке «Мои»');
          setSaveTpl(null);
        }}
      />
    </div>
  );
}
