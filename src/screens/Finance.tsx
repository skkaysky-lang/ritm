import { useMemo, useState } from 'react';
import { useStore, type Pot, type Sub, type Txn } from '../store';
import { addMonths, allowance, catById, curMonth, fmtMoney, fmtShort, monthLabel, monthOf, monthStats, potMonthly, subsMonthly, subStatus, trackedFromStart } from '../lib/money';
import { dayKey, humanDay, plural, WD, weekday } from '../lib/date';
import { haptic } from '../lib/telegram';
import { Icon } from '../components/Icon';
import { Bars, Donut } from '../components/charts';
import { Bar, CountUp, Empty, Ring, Segmented, toast } from '../components/ui';
import { BudgetSheet, CatBudgetSheet, PotMoveSheet, PotSheet, SubSheet, TxnSheet } from '../components/MoneySheets';

type View = 'overview' | 'ops' | 'plans';

export function Finance() {
  const s = useStore();
  const cur = s.fin.currency;
  const [month, setMonth] = useState(curMonth());
  const [view, setView] = useState<View>('overview');
  const [txn, setTxn] = useState<{ open: boolean; edit: Txn | null; type: 'exp' | 'inc' }>({ open: false, edit: null, type: 'exp' });
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [catSel, setCatSel] = useState<string | null>(null);
  const [catLimit, setCatLimit] = useState<string | null>(null);
  const [potEdit, setPotEdit] = useState<Pot | null | undefined>(undefined);
  const [potOpen, setPotOpen] = useState<string | null>(null);
  const [subEdit, setSubEdit] = useState<Sub | null | undefined>(undefined);
  const [filter, setFilter] = useState<'all' | 'exp' | 'inc'>('all');
  const [limit, setLimit] = useState(40);

  const isCur = month === curMonth();
  const st = useMemo(() => monthStats(s, month), [s.txns, s.fin, month]); // eslint-disable-line react-hooks/exhaustive-deps
  const prev = useMemo(() => monthStats(s, addMonths(month, -1)), [s.txns, s.fin, month]); // eslint-disable-line react-hooks/exhaustive-deps
  const al = isCur ? allowance(s) : null;
  const budget = s.fin.budget;

  const add = (type: 'exp' | 'inc') => {
    haptic.light();
    setTxn({ open: true, edit: null, type });
  };

  const sel = catSel ? st.byCat.find((c) => c.cat.id === catSel) : null;
  const diff = prev.exp > 0 && st.daysPassed >= 5 && trackedFromStart(s, addMonths(month, -1)) ? (st.forecast - prev.exp) / prev.exp : null;

  return (
    <div className="screen stack">
      <div className="page-head">
        <div>
          <div className="page-title">Деньги</div>
          <div className="page-sub">{budget ? `Бюджет ${fmtMoney(budget, cur)} в месяц` : 'Расходы, доходы и накопления'}</div>
        </div>
        <button className="icon-btn" onClick={() => (haptic.light(), setBudgetOpen(true))} aria-label="Бюджет и валюта">
          <Icon name="settings" />
        </button>
      </div>

      {/* ---------- Месяц ---------- */}
      <div className="row-between">
        <button className="icon-btn sm" onClick={() => (haptic.select(), setMonth(addMonths(month, -1)), setCatSel(null))} aria-label="Прошлый месяц">
          <Icon name="left" size={18} />
        </button>
        <button className="bold" style={{ fontSize: 17 }} onClick={() => setMonth(curMonth())}>
          {monthLabel(month)}
        </button>
        <button className="icon-btn sm" disabled={isCur} style={{ opacity: isCur ? 0.3 : 1 }} onClick={() => (haptic.select(), setMonth(addMonths(month, 1)), setCatSel(null))} aria-label="Следующий месяц">
          <Icon name="right" size={18} />
        </button>
      </div>

      {/* ---------- Главная карточка ---------- */}
      <div className="card hero-money">
        {al ? (
          <>
            <div className="small bold" style={{ opacity: 0.8 }}>
              {al.todayLeft >= 0 ? 'Сегодня можно потратить ещё' : 'Сегодня перерасход'}
            </div>
            <div className="num" style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.15 }}>
              <CountUp value={Math.abs(al.todayLeft)} format={(v) => fmtMoney(Math.round(v), cur)} />
            </div>
            <div className="small" style={{ opacity: 0.8 }}>
              Лимит дня {fmtMoney(Math.round(al.perDay), cur)} · потрачено {fmtMoney(al.todaySpent, cur)}
            </div>
            <div style={{ margin: '14px 0 6px', position: 'relative' }}>
              <div className="bar thick" style={{ background: 'rgba(255,255,255,.2)' }}>
                <i style={{ width: `${Math.min(100, (al.spent / al.budget) * 100)}%`, ['--c' as string]: al.left < 0 ? '#ff8f9c' : '#fff' }} />
              </div>
              {/* где «должен быть» расход к сегодняшнему дню */}
              <i style={{ position: 'absolute', top: -3, bottom: -3, left: `${(st.daysPassed / st.daysTotal) * 100}%`, width: 2, borderRadius: 1, background: 'rgba(0,0,0,.45)' }} />
            </div>
            <div className="row-between tiny bold" style={{ opacity: 0.85 }}>
              <span>
                {fmtMoney(al.spent, cur)} из {fmtMoney(al.budget, cur)}
              </span>
              <span>{al.left >= 0 ? `осталось ${fmtMoney(al.left, cur)} на ${al.daysLeft} ${plural(al.daysLeft, 'день', 'дня', 'дней')}` : `превышен на ${fmtMoney(-al.left, cur)}`}</span>
            </div>
          </>
        ) : (
          <>
            <div className="small bold" style={{ opacity: 0.8 }}>
              Расходы за {monthLabel(month).toLowerCase()}
            </div>
            <div className="num" style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.15 }}>
              <CountUp value={st.exp} format={(v) => fmtMoney(Math.round(v), cur)} />
            </div>
            {isCur && !budget ? (
              <button className="btn glass sm" style={{ marginTop: 10 }} onClick={() => setBudgetOpen(true)}>
                🎯 Задать бюджет на месяц
              </button>
            ) : (
              budget != null && (
                <div className="small" style={{ opacity: 0.8 }}>
                  {st.exp <= budget ? `В бюджете: осталось ${fmtMoney(budget - st.exp, cur)}` : `Бюджет превышен на ${fmtMoney(st.exp - budget, cur)}`}
                </div>
              )
            )}
          </>
        )}
        <div className="grid-3" style={{ marginTop: 14 }}>
          {(
            [
              ['Доходы', st.inc, true],
              ['Расходы', -st.exp, false],
              ['Баланс', st.balance, true],
            ] as const
          ).map(([l, v, signed]) => (
            <div key={l} className="hero-stat">
              <div className="tiny bold" style={{ opacity: 0.75 }}>
                {l}
              </div>
              <div className="bold num" style={{ fontSize: 15 }}>
                {Math.abs(v) >= 100000 ? `${v < 0 ? '−' : signed && v > 0 ? '+' : ''}${fmtShort(Math.abs(v))} ${cur}` : fmtMoney(v, cur, signed)}
              </div>
            </div>
          ))}
        </div>
        <div className="grid-2" style={{ marginTop: 12 }}>
          <button className="btn white" style={{ height: 46 }} onClick={() => add('exp')}>
            <Icon name="minus" size={18} stroke={2.6} /> Расход
          </button>
          <button className="btn glass" style={{ height: 46 }} onClick={() => add('inc')}>
            <Icon name="plus" size={18} stroke={2.6} /> Доход
          </button>
        </div>
      </div>

      <Segmented
        value={view}
        onChange={setView}
        options={[
          { v: 'overview', label: 'Обзор' },
          { v: 'ops', label: `Операции${st.count ? ` · ${st.count}` : ''}` },
          { v: 'plans', label: 'Планы' },
        ]}
      />

      {/* =================== ОБЗОР =================== */}
      {view === 'overview' &&
        (st.exp === 0 ? (
          <div className="card">
            <Empty emoji="💸" text={isCur ? 'Записывай траты сразу после покупки: это 5 секунд. Через неделю увидишь, куда на самом деле уходят деньги.' : 'В этом месяце расходов нет'}>
              {isCur && (
                <button className="btn sm" style={{ ['--c1' as string]: 'var(--money)', ['--c2' as string]: 'var(--money-2)' }} onClick={() => add('exp')}>
                  <Icon name="plus" size={18} /> Первая трата
                </button>
              )}
            </Empty>
          </div>
        ) : (
          <>
            <div className="card stack">
              <div className="card-title">Куда уходят деньги</div>
              <div className="row" style={{ gap: 14, justifyContent: 'center' }}>
                <Donut segments={st.byCat.map((c) => ({ key: c.cat.id, value: c.sum, color: c.cat.color }))} selected={catSel} onSelect={setCatSel}>
                  <div style={{ fontSize: 22 }}>{sel ? sel.cat.emoji : '💸'}</div>
                  <div className="bold num" style={{ fontSize: 17, lineHeight: 1.1 }}>
                    {fmtShort(sel ? sel.sum : st.exp)} {cur}
                  </div>
                  <div className="tiny muted bold">{sel ? `${Math.round(sel.share * 100)}% · ${sel.cat.label}` : 'всего'}</div>
                </Donut>
              </div>
              <div className="list">
                {st.byCat.map((c) => {
                  const lim = s.fin.catBudgets[c.cat.id];
                  const over = lim != null && c.sum > lim;
                  return (
                    <button
                      key={c.cat.id}
                      className="list-item"
                      style={{ opacity: catSel && catSel !== c.cat.id ? 0.45 : 1, transition: 'opacity .2s' }}
                      onClick={() => {
                        haptic.light();
                        setCatLimit(c.cat.id);
                      }}
                    >
                      <div className="emoji-box sm" style={{ background: `color-mix(in srgb, ${c.cat.color} 20%, transparent)` }}>
                        {c.cat.emoji}
                      </div>
                      <div className="grow" style={{ minWidth: 0 }}>
                        <div className="row-between">
                          <span className="bold ellipsis">{c.cat.label}</span>
                          <span className="bold num" style={{ color: over ? 'var(--bad)' : undefined }}>
                            {fmtMoney(c.sum, cur)}
                          </span>
                        </div>
                        <div style={{ margin: '5px 0 3px' }}>
                          <Bar value={lim != null ? c.sum / lim : c.share} color={over ? 'var(--bad)' : c.cat.color} className="thin" />
                        </div>
                        <div className="row-between tiny muted bold">
                          <span>
                            {Math.round(c.share * 100)}% · {c.count} {plural(c.count, 'покупка', 'покупки', 'покупок')}
                          </span>
                          <span>{lim != null ? (over ? `лимит превышен на ${fmtMoney(c.sum - lim, cur)}` : `лимит ${fmtMoney(lim, cur)}`) : 'задать лимит ›'}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="card stack">
              <div className="card-title">Расходы по дням</div>
              <Bars
                data={st.byDay.slice(0, isCur ? st.daysPassed : st.daysTotal).map((v, i) => {
                  const k = `${month}-${String(i + 1).padStart(2, '0')}`;
                  const perDay = budget ? budget / st.daysTotal : 0;
                  return {
                    key: k,
                    label: st.daysPassed <= 10 ? `${i + 1} ${WD[weekday(k)].toLowerCase()}` : String(i + 1),
                    value: v,
                    color: perDay && v > perDay * 1.5 ? 'linear-gradient(180deg, #ff6b8b, #ff9f43)' : undefined,
                  };
                })}
                color="var(--money)"
                color2="var(--money-2)"
                goal={budget ? budget / st.daysTotal : undefined}
                goalLabel={budget ? 'лимит дня' : undefined}
                format={(v) => fmtMoney(v, cur)}
              />
            </div>

            <div className="grid-2">
              <MiniStat emoji="📅" label="В среднем в день" value={fmtMoney(Math.round(st.avgPerDay), cur)} />
              <MiniStat emoji="🧘" label="Дней без трат" value={`${st.noSpendDays} из ${st.daysPassed}`} />
              <MiniStat
                emoji="🔮"
                label={isCur ? 'Прогноз на месяц' : 'Итог месяца'}
                value={fmtMoney(Math.round(st.forecast), cur)}
                hint={budget && isCur ? (st.forecast > budget ? `+${fmtShort(st.forecast - budget)} к бюджету` : 'в бюджете') : undefined}
                tone={budget && isCur ? (st.forecast > budget ? 'bad' : 'good') : undefined}
              />
              <MiniStat
                emoji={diff != null && diff > 0 ? '📈' : '📉'}
                label="К прошлому месяцу"
                value={diff != null ? `${diff > 0 ? '+' : '−'}${Math.abs(Math.round(diff * 100))}%` : '—'}
                hint={diff != null ? (diff > 0 ? 'тратишь больше' : 'тратишь меньше') : 'мало данных'}
                tone={diff != null ? (diff > 0.05 ? 'bad' : 'good') : undefined}
              />
            </div>

            {st.biggest && (
              <div className="card tight row">
                <div className="emoji-box">{catById(s.fin, st.biggest.cat).emoji}</div>
                <div className="grow">
                  <div className="tiny muted bold">Самая большая трата</div>
                  <div className="bold ellipsis">
                    {st.biggest.note || catById(s.fin, st.biggest.cat).label} · {humanDay(st.biggest.day).toLowerCase()}
                  </div>
                </div>
                <span className="bold num">{fmtMoney(st.biggest.amount, cur)}</span>
              </div>
            )}
          </>
        ))}

      {/* =================== ОПЕРАЦИИ =================== */}
      {view === 'ops' && (
        <OpsList
          month={month}
          filter={filter}
          setFilter={setFilter}
          limit={limit}
          more={() => setLimit(limit + 60)}
          onOpen={(t) => {
            haptic.light();
            setTxn({ open: true, edit: t, type: t.type });
          }}
          onAdd={() => add('exp')}
        />
      )}

      {/* =================== ПЛАНЫ =================== */}
      {view === 'plans' && (
        <>
          <div className="row-between">
            <div className="section-title" style={{ margin: '0 4px' }}>
              Копилки {s.pots.length ? `· ${fmtMoney(s.pots.reduce((a, p) => a + p.saved, 0), cur)}` : ''}
            </div>
            <button className="link" onClick={() => (haptic.light(), setPotEdit(null))}>
              + Новая
            </button>
          </div>
          {s.pots.length ? (
            <div className="stack-sm">
              {s.pots.map((p) => {
                const v = p.saved / p.target;
                const m = potMonthly(p.target, p.saved, p.deadline);
                return (
                  <button key={p.id} className="card tap row" style={{ textAlign: 'left', gap: 14 }} onClick={() => (haptic.light(), setPotOpen(p.id))}>
                    <Ring value={v} size={58} stroke={6} colors={['var(--money)', 'var(--money-2)']}>
                      <span style={{ fontSize: 22 }}>{p.emoji}</span>
                    </Ring>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="row-between">
                        <span className="bold ellipsis">{p.name}</span>
                        <span className="small bold num">{Math.min(100, Math.round(v * 100))}%</span>
                      </div>
                      <div className="small num">
                        <b>{fmtMoney(p.saved, cur)}</b> <span className="muted">из {fmtMoney(p.target, cur)}</span>
                      </div>
                      <div className="tiny muted bold">
                        {v >= 1 ? 'Собрано 🎉' : m ? `по ${fmtMoney(Math.ceil(m / 100) * 100, cur)} в месяц до ${humanDay(p.deadline!)}` : `осталось ${fmtMoney(p.target - p.saved, cur)}`}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="card">
              <Empty emoji="🐷" text="Копи на отпуск, технику или подушку безопасности. Задай сумму и срок — посчитаю, сколько откладывать в месяц.">
                <button className="btn sm" style={{ ['--c1' as string]: 'var(--money)', ['--c2' as string]: 'var(--money-2)' }} onClick={() => setPotEdit(null)}>
                  <Icon name="plus" size={18} /> Создать копилку
                </button>
              </Empty>
            </div>
          )}

          <div className="row-between" style={{ marginTop: 6 }}>
            <div className="section-title" style={{ margin: '0 4px' }}>
              Регулярные платежи
            </div>
            <button className="link" onClick={() => (haptic.light(), setSubEdit(null))}>
              + Добавить
            </button>
          </div>
          {s.subs.length ? (
            <>
              <div className="card" style={{ paddingTop: 6, paddingBottom: 6 }}>
                <div className="list">
                  {[...s.subs]
                    .map((x) => ({ x, st: subStatus(x) }))
                    .sort((a, b) => a.st.inDays - b.st.inDays)
                    .map(({ x, st: ss }) => (
                      <div key={x.id} className="list-item">
                        <button className="row grow" style={{ textAlign: 'left', minWidth: 0 }} onClick={() => (haptic.light(), setSubEdit(x))}>
                          <div className="emoji-box sm">{x.emoji}</div>
                          <div className="grow" style={{ minWidth: 0 }}>
                            <div className="bold ellipsis">{x.name}</div>
                            <div className="tiny bold" style={{ color: ss.paid ? 'var(--good)' : ss.inDays < 0 ? 'var(--bad)' : ss.inDays <= 3 ? 'var(--warn)' : 'var(--text-2)' }}>
                              {ss.paid
                                ? `оплачено ✓ · следующий ${humanDay(ss.due).toLowerCase()}`
                                : ss.inDays < 0
                                  ? `просрочен на ${-ss.inDays} ${plural(-ss.inDays, 'день', 'дня', 'дней')}`
                                  : ss.inDays === 0
                                    ? 'сегодня'
                                    : `${x.dom}-го · через ${ss.inDays} ${plural(ss.inDays, 'день', 'дня', 'дней')}`}
                            </div>
                          </div>
                        </button>
                        <div style={{ textAlign: 'right' }}>
                          <div className="bold num">{fmtMoney(x.amount, cur)}</div>
                          {!ss.paid && (
                            <button
                              className="link tiny"
                              onClick={() => {
                                s.paySub(x.id, dayKey());
                                haptic.success();
                                toast(`${x.emoji} ${x.name}: оплата записана в расходы`);
                              }}
                            >
                              Оплатил
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
              <div className="grid-2">
                <MiniStat emoji="🔁" label="В месяц" value={fmtMoney(subsMonthly(s), cur)} />
                <MiniStat emoji="🗓️" label="В год" value={fmtMoney(subsMonthly(s) * 12, cur)} />
              </div>
            </>
          ) : (
            <div className="card">
              <Empty emoji="🔁" text="Аренда, связь, подписки, кредит. Добавь их сюда — напомню о дате и одним нажатием запишу оплату в расходы." />
            </div>
          )}
        </>
      )}

      <TxnSheet open={txn.open} edit={txn.edit} type={txn.type} onClose={() => setTxn({ ...txn, open: false })} />
      <BudgetSheet open={budgetOpen} onClose={() => setBudgetOpen(false)} />
      <CatBudgetSheet cat={catLimit} onClose={() => setCatLimit(null)} />
      <PotSheet open={potEdit !== undefined} pot={potEdit ?? null} onClose={() => setPotEdit(undefined)} />
      <PotMoveSheet
        id={potOpen}
        onClose={() => setPotOpen(null)}
        onEdit={(p) => {
          setPotOpen(null);
          setTimeout(() => setPotEdit(p), 220);
        }}
      />
      <SubSheet open={subEdit !== undefined} sub={subEdit ?? null} onClose={() => setSubEdit(undefined)} />
    </div>
  );
}

function MiniStat({ emoji, label, value, hint, tone }: { emoji: string; label: string; value: string; hint?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="card tight">
      <div className="row-between">
        <span style={{ fontSize: 20 }}>{emoji}</span>
        {hint && (
          <span className="tiny bold" style={{ color: tone === 'bad' ? 'var(--bad)' : tone === 'good' ? 'var(--good)' : 'var(--text-3)' }}>
            {hint}
          </span>
        )}
      </div>
      <div className="stat" style={{ marginTop: 8 }}>
        <span className="v num" style={{ fontSize: 18 }}>
          {value}
        </span>
        <span className="l">{label}</span>
      </div>
    </div>
  );
}

function OpsList({
  month,
  filter,
  setFilter,
  limit,
  more,
  onOpen,
  onAdd,
}: {
  month: string;
  filter: 'all' | 'exp' | 'inc';
  setFilter: (f: 'all' | 'exp' | 'inc') => void;
  limit: number;
  more: () => void;
  onOpen: (t: Txn) => void;
  onAdd: () => void;
}) {
  const s = useStore();
  const cur = s.fin.currency;
  const all = useMemo(
    () => s.txns.filter((t) => monthOf(t.day) === month && (filter === 'all' || t.type === filter)).sort((a, b) => (a.day === b.day ? b.time - a.time : a.day < b.day ? 1 : -1)),
    [s.txns, month, filter],
  );
  const shown = all.slice(0, limit);
  const groups: { day: string; items: Txn[] }[] = [];
  for (const t of shown) {
    const g = groups[groups.length - 1];
    if (g && g.day === t.day) g.items.push(t);
    else groups.push({ day: t.day, items: [t] });
  }
  return (
    <>
      <div className="chips">
        {(
          [
            ['all', 'Все'],
            ['exp', '💸 Расходы'],
            ['inc', '💰 Доходы'],
          ] as const
        ).map(([v, l]) => (
          <button key={v} className={`chip ${filter === v ? 'on' : ''}`} onClick={() => (haptic.select(), setFilter(v))}>
            {l}
          </button>
        ))}
      </div>
      {groups.length === 0 ? (
        <div className="card">
          <Empty emoji="🧾" text="Операций пока нет">
            <button className="btn sm" style={{ ['--c1' as string]: 'var(--money)', ['--c2' as string]: 'var(--money-2)' }} onClick={onAdd}>
              <Icon name="plus" size={18} /> Добавить
            </button>
          </Empty>
        </div>
      ) : (
        groups.map((g) => {
          const dayExp = g.items.reduce((a, t) => a + (t.type === 'exp' ? t.amount : 0), 0);
          return (
            <div key={g.day}>
              <div className="row-between" style={{ margin: '4px 4px 6px' }}>
                <span className="small bold">
                  {humanDay(g.day)} <span className="faint">· {WD[weekday(g.day)].toLowerCase()}</span>
                </span>
                {dayExp > 0 && <span className="small muted bold num">−{fmtMoney(dayExp, cur)}</span>}
              </div>
              <div className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
                <div className="list">
                  {g.items.map((t) => {
                    const c = catById(s.fin, t.cat);
                    return (
                      <button key={t.id} className="list-item" onClick={() => onOpen(t)}>
                        <div className="emoji-box sm" style={{ background: `color-mix(in srgb, ${c.color} 20%, transparent)` }}>
                          {c.emoji}
                        </div>
                        <div className="grow" style={{ minWidth: 0 }}>
                          <div className="bold ellipsis">{t.note || c.label}</div>
                          {t.note && <div className="tiny muted bold">{c.label}</div>}
                        </div>
                        <span className="bold num" style={{ color: t.type === 'inc' ? 'var(--good)' : undefined }}>
                          {t.type === 'inc' ? '+' : '−'}
                          {fmtMoney(t.amount, cur)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })
      )}
      {all.length > shown.length && (
        <button className="btn ghost" onClick={more}>
          Показать ещё ({all.length - shown.length})
        </button>
      )}
    </>
  );
}
