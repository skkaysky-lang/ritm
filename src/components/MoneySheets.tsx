import { useState } from 'react';
import { useStore, type Pot, type Sub, type Txn } from '../store';
import { CAT_COLORS, CURRENCIES, MONEY_EMOJI, POT_EMOJI, SUB_PRESETS } from '../data/finance';
import { addMonths, allowance, catById, catsByUsage, curMonth, fmtMoney, monthLabel, monthStats, parseAmount, potMonthly } from '../lib/money';
import { addDays, dayKey, humanDay } from '../lib/date';
import { confirmDialog, haptic } from '../lib/telegram';
import { Icon } from './Icon';
import { confetti, Ring, Segmented, Sheet, Stepper, toast } from './ui';
import { EmojiPicker } from './FoodSheets';

/* ===================== Поле суммы (понимает «250+120») ===================== */

export function AmountInput({ value, onChange, cur, autoFocus, color }: { value: string; onChange: (v: string) => void; cur: string; autoFocus?: boolean; color?: string }) {
  const sum = parseAmount(value);
  const isExpr = /[+-]/.test(value.slice(1));
  return (
    <div className="card center" style={{ background: 'var(--surface-2)', padding: '14px 12px' }}>
      <div className="row" style={{ justifyContent: 'center', gap: 6 }}>
        <input
          className="big-input num"
          inputMode="decimal"
          placeholder="0"
          autoFocus={autoFocus}
          value={value}
          style={{ color, width: `${Math.max(2, value.length || 1) * 0.62 + 0.4}em`, maxWidth: '78%' }}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.,+-]/g, '').slice(0, 24))}
        />
        <span className="muted bold" style={{ fontSize: 24 }}>
          {cur}
        </span>
      </div>
      <div className="tiny faint bold" style={{ height: 16 }}>
        {isExpr && sum > 0 ? `= ${fmtMoney(sum, cur)}` : 'можно складывать: 250+120'}
      </div>
    </div>
  );
}

function DayChips({ day, onChange }: { day: string; onChange: (d: string) => void }) {
  const today = dayKey();
  const quick = [0, -1, -2].map((n) => addDays(today, n));
  return (
    <div className="chips" style={{ alignItems: 'center' }}>
      {quick.map((k) => (
        <button key={k} className={`chip ${day === k ? 'on' : ''}`} onClick={() => (haptic.select(), onChange(k))}>
          {humanDay(k)}
        </button>
      ))}
      <label className={`chip ${quick.includes(day) ? '' : 'on'}`} style={{ position: 'relative' }}>
        📅 {quick.includes(day) ? 'Дата' : humanDay(day)}
        <input type="date" value={day} max={today} onChange={(e) => e.target.value && onChange(e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%' }} />
      </label>
    </div>
  );
}

/* ===================== Операция: расход или доход ===================== */

export function TxnSheet({ open, onClose, edit, type: initialType = 'exp', day: initialDay }: { open: boolean; onClose: () => void; edit?: Txn | null; type?: 'exp' | 'inc'; day?: string }) {
  const s = useStore();
  const cur = s.fin.currency;
  const [type, setType] = useState<'exp' | 'inc'>(initialType);
  const [amount, setAmount] = useState('');
  const [cat, setCat] = useState('');
  const [note, setNote] = useState('');
  const [day, setDay] = useState(dayKey());
  const [newCat, setNewCat] = useState(false);
  const [was, setWas] = useState(false);
  if (open !== was) {
    setWas(open);
    if (open) {
      setType(edit?.type ?? initialType);
      setAmount(edit ? String(edit.amount).replace('.', ',') : '');
      setCat(edit?.cat ?? '');
      setNote(edit?.note ?? '');
      setDay(edit?.day ?? initialDay ?? dayKey());
      setNewCat(false);
    }
  }
  const cats = catsByUsage(s, type);
  const picked = cats.find((c) => c.id === cat) ?? cats[0];
  const sum = parseAmount(amount);
  const accent = type === 'exp' ? 'var(--bad)' : 'var(--good)';

  const save = () => {
    const before = allowance(s);
    if (edit) s.updateTxn(edit.id, { type, amount: sum, cat: picked.id, note: note.trim() || undefined, day });
    else s.addTxn({ type, amount: sum, cat: picked.id, note: note.trim() || undefined, day });
    haptic.success();
    const after = allowance(useStore.getState());
    if (type === 'exp' && before && after && before.todayLeft >= 0 && after.todayLeft < 0) toast(`⚠️ Лимит на сегодня превышен на ${fmtMoney(-after.todayLeft, cur)}`);
    else toast(`${picked.emoji} ${type === 'exp' ? '−' : '+'}${fmtMoney(sum, cur)} · ${picked.label}`);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={edit ? 'Операция' : type === 'exp' ? 'Новый расход' : 'Новый доход'} full>
      <div className="stack">
        <Segmented
          value={type}
          onChange={(v) => {
            setType(v);
            setCat('');
          }}
          options={[
            { v: 'exp', label: '💸 Расход' },
            { v: 'inc', label: '💰 Доход' },
          ]}
        />
        <AmountInput value={amount} onChange={setAmount} cur={cur} autoFocus={!edit} color={accent} />

        {newCat ? (
          <NewCatForm
            type={type}
            onDone={(id) => {
              setNewCat(false);
              if (id) setCat(id);
            }}
          />
        ) : (
          <div className="cat-grid">
            {cats.map((c) => (
              <button key={c.id} className={`cat-tile ${picked.id === c.id ? 'on' : ''}`} style={{ ['--cc' as string]: c.color }} onClick={() => (haptic.select(), setCat(c.id))}>
                <span className="ce">{c.emoji}</span>
                <span className="cl">{c.label}</span>
              </button>
            ))}
            <button className="cat-tile" onClick={() => setNewCat(true)}>
              <span className="ce">＋</span>
              <span className="cl">Своя</span>
            </button>
          </div>
        )}

        <input className="input" placeholder="Комментарий (необязательно)" value={note} onChange={(e) => setNote(e.target.value)} />
        <DayChips day={day} onChange={setDay} />

        <div className="row">
          {edit && (
            <button
              className="btn danger"
              style={{ width: 56, padding: 0, flexShrink: 0 }}
              aria-label="Удалить"
              onClick={() => {
                const r = s.removeTxn(edit.id);
                haptic.warning();
                onClose();
                if (r) toast('Операция удалена', { label: 'Вернуть', fn: () => useStore.getState().restoreTxn(r) });
              }}
            >
              <Icon name="trash" size={18} />
            </button>
          )}
          <button className="btn" disabled={sum <= 0} style={{ ['--c1' as string]: type === 'exp' ? '#ff6b8b' : 'var(--good)', ['--c2' as string]: type === 'exp' ? '#ff9f43' : '#19b3d6' }} onClick={save}>
            {edit ? 'Сохранить' : type === 'exp' ? 'Записать расход' : 'Записать доход'}
            {sum > 0 ? ` · ${fmtMoney(sum, cur)}` : ''}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

function NewCatForm({ type, onDone }: { type: 'exp' | 'inc'; onDone: (id: string | null) => void }) {
  const addFinCat = useStore((s) => s.addFinCat);
  const n = useStore((s) => s.fin.customCats.length);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('📦');
  return (
    <div className="card stack-sm" style={{ background: 'var(--surface-2)' }}>
      <div className="small bold">Своя категория</div>
      <div className="row">
        <EmojiPicker value={emoji} onChange={setEmoji} list={MONEY_EMOJI} />
        <input className="input" placeholder="Название" value={name} autoFocus maxLength={18} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid-2">
        <button className="btn ghost sm" style={{ width: '100%' }} onClick={() => onDone(null)}>
          Отмена
        </button>
        <button
          className="btn sm"
          style={{ width: '100%' }}
          disabled={!name.trim()}
          onClick={() => {
            const id = addFinCat({ label: name.trim(), emoji, type, color: CAT_COLORS[n % CAT_COLORS.length] });
            haptic.success();
            onDone(id);
          }}
        >
          Создать
        </button>
      </div>
    </div>
  );
}

/* ===================== Бюджет и валюта ===================== */

export function BudgetSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useStore();
  const cur = s.fin.currency;
  const [val, setVal] = useState('');
  const [was, setWas] = useState(false);
  if (open !== was) {
    setWas(open);
    if (open) setVal(s.fin.budget ? String(s.fin.budget) : '');
  }
  const prev = monthStats(s, addMonths(curMonth(), -1));
  const now = monthStats(s, curMonth());
  const sum = parseAmount(val);
  const hints = [prev.exp > 0 ? Math.round((prev.exp * 0.9) / 1000) * 1000 : 0, now.inc > 0 ? Math.round((now.inc * 0.8) / 1000) * 1000 : 0].filter((v, i, a) => v > 0 && a.indexOf(v) === i);
  return (
    <Sheet open={open} onClose={onClose} title="Бюджет на месяц">
      <div className="stack">
        <div className="small muted">Сколько планируешь тратить за месяц. Я разделю остаток на оставшиеся дни и покажу, сколько можно потратить сегодня.</div>
        <AmountInput value={val} onChange={setVal} cur={cur} autoFocus />
        {(prev.exp > 0 || hints.length > 0) && (
          <div className="stack-sm">
            {prev.exp > 0 && (
              <div className="tiny muted bold">
                В {monthLabel(addMonths(curMonth(), -1)).toLowerCase()} потрачено {fmtMoney(prev.exp, cur)}
              </div>
            )}
            <div className="chips">
              {hints.map((h) => (
                <button key={h} className="chip" onClick={() => (haptic.select(), setVal(String(h)))}>
                  {fmtMoney(h, cur)}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="field">
          <label>Валюта</label>
          <div className="chips wrap">
            {CURRENCIES.map((c) => (
              <button key={c} className={`chip ${cur === c ? 'on' : ''}`} onClick={() => (haptic.select(), s.setFin({ currency: c }))}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="row">
          {s.fin.budget != null && (
            <button
              className="btn ghost"
              style={{ width: 'auto', flexShrink: 0 }}
              onClick={() => {
                s.setFin({ budget: null });
                onClose();
              }}
            >
              Убрать
            </button>
          )}
          <button
            className="btn"
            disabled={sum <= 0}
            style={{ ['--c1' as string]: 'var(--money)', ['--c2' as string]: 'var(--money-2)' }}
            onClick={() => {
              s.setFin({ budget: sum });
              haptic.success();
              toast('Бюджет сохранён');
              onClose();
            }}
          >
            Сохранить
          </button>
        </div>
      </div>
    </Sheet>
  );
}

/** Лимит на одну категорию */
export function CatBudgetSheet({ cat, onClose }: { cat: string | null; onClose: () => void }) {
  const s = useStore();
  const cur = s.fin.currency;
  const [val, setVal] = useState('');
  const [was, setWas] = useState<string | null>(null);
  if (cat !== was) {
    setWas(cat);
    if (cat) setVal(s.fin.catBudgets[cat] ? String(s.fin.catBudgets[cat]) : '');
  }
  const c = cat ? catById(s.fin, cat) : null;
  const sum = parseAmount(val);
  const isCustom = !!cat && s.fin.customCats.some((x) => x.id === cat);
  return (
    <Sheet open={!!cat} onClose={onClose} title={c ? `${c.emoji} ${c.label}` : ''}>
      {c && (
        <div className="stack">
          <div className="small muted">Лимит на эту категорию в месяц. Покажу полоску и предупрежу, когда подойдёшь к границе.</div>
          <AmountInput value={val} onChange={setVal} cur={cur} autoFocus />
          <div className="row">
            {s.fin.catBudgets[c.id] != null && (
              <button
                className="btn ghost"
                style={{ width: 'auto', flexShrink: 0 }}
                onClick={() => {
                  s.setCatBudget(c.id, null);
                  onClose();
                }}
              >
                Убрать лимит
              </button>
            )}
            <button
              className="btn"
              disabled={sum <= 0}
              style={{ ['--c1' as string]: c.color, ['--c2' as string]: c.color }}
              onClick={() => {
                s.setCatBudget(c.id, sum);
                haptic.success();
                onClose();
              }}
            >
              Сохранить
            </button>
          </div>
          {isCustom && (
            <button
              className="btn danger"
              onClick={async () => {
                if (await confirmDialog(`Удалить категорию «${c.label}»? Операции останутся, но попадут в «Другое».`)) {
                  s.removeFinCat(c.id);
                  s.setCatBudget(c.id, null);
                  onClose();
                }
              }}
            >
              <Icon name="trash" size={18} /> Удалить категорию
            </button>
          )}
        </div>
      )}
    </Sheet>
  );
}

/* ===================== Копилки ===================== */

export function PotSheet({ open, onClose, pot }: { open: boolean; onClose: () => void; pot?: Pot | null }) {
  const s = useStore();
  const cur = s.fin.currency;
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🎯');
  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [was, setWas] = useState(false);
  if (open !== was) {
    setWas(open);
    if (open) {
      setName(pot?.name ?? '');
      setEmoji(pot?.emoji ?? '🎯');
      setTarget(pot ? String(pot.target) : '');
      setDeadline(pot?.deadline ?? '');
    }
  }
  const sum = parseAmount(target);
  const monthly = potMonthly(sum, pot?.saved ?? 0, deadline || undefined);
  return (
    <Sheet open={open} onClose={onClose} title={pot ? 'Изменить копилку' : 'Новая копилка'}>
      <div className="stack">
        <div className="row">
          <EmojiPicker value={emoji} onChange={setEmoji} list={POT_EMOJI} />
          <input className="input" placeholder="На что копим: отпуск, ноутбук…" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Сколько нужно</label>
          <AmountInput value={target} onChange={setTarget} cur={cur} />
        </div>
        <div className="field">
          <label>К какой дате (необязательно)</label>
          <input type="date" className="input" value={deadline} min={dayKey()} onChange={(e) => setDeadline(e.target.value)} />
          <div className="chips">
            {(
              [
                ['3 месяца', 91],
                ['Полгода', 182],
                ['Год', 365],
              ] as const
            ).map(([l, n]) => {
              const k = addDays(dayKey(), n);
              return (
                <button key={l} className={`chip ${deadline === k ? 'on' : ''}`} onClick={() => (haptic.select(), setDeadline(k))}>
                  {l}
                </button>
              );
            })}
            {deadline && (
              <button className="chip" onClick={() => setDeadline('')}>
                Без срока
              </button>
            )}
          </div>
        </div>
        {monthly != null && sum > 0 && (
          <div className="stat-box small">
            Чтобы успеть, откладывай по <b>{fmtMoney(Math.ceil(monthly / 100) * 100, cur)}</b> в месяц
          </div>
        )}
        <div className="row">
          {pot && (
            <button
              className="btn danger"
              style={{ width: 56, padding: 0, flexShrink: 0 }}
              aria-label="Удалить"
              onClick={async () => {
                if (await confirmDialog(`Удалить копилку «${pot.name}»?`)) {
                  s.removePot(pot.id);
                  onClose();
                }
              }}
            >
              <Icon name="trash" size={18} />
            </button>
          )}
          <button
            className="btn"
            disabled={!name.trim() || sum <= 0}
            style={{ ['--c1' as string]: 'var(--money)', ['--c2' as string]: 'var(--money-2)' }}
            onClick={() => {
              const data = { name: name.trim(), emoji, target: sum, deadline: deadline || undefined };
              if (pot) s.updatePot(pot.id, data);
              else s.addPot(data);
              haptic.success();
              onClose();
            }}
          >
            {pot ? 'Сохранить' : 'Создать копилку'}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

export function PotMoveSheet({ id, onClose, onEdit }: { id: string | null; onClose: () => void; onEdit: (p: Pot) => void }) {
  const s = useStore();
  const cur = s.fin.currency;
  const pot = s.pots.find((p) => p.id === id) ?? null;
  const [val, setVal] = useState('');
  const [was, setWas] = useState<string | null>(null);
  if (id !== was) {
    setWas(id);
    setVal('');
  }
  const sum = parseAmount(val);
  const monthly = pot ? potMonthly(pot.target, pot.saved, pot.deadline) : null;
  const move = (dir: 1 | -1) => {
    if (!pot) return;
    const before = pot.saved;
    s.movePot(pot.id, dir * sum);
    setVal('');
    if (dir > 0 && before < pot.target && before + sum >= pot.target) {
      haptic.success();
      confetti();
      toast(`🎉 Копилка «${pot.name}» собрана!`);
    } else {
      haptic.light();
      toast(`${pot.emoji} ${dir > 0 ? '+' : '−'}${fmtMoney(sum, cur)}`);
    }
  };
  return (
    <Sheet
      open={!!pot}
      onClose={onClose}
      title={pot ? `${pot.emoji} ${pot.name}` : ''}
      right={
        pot && (
          <button className="icon-btn sm" onClick={() => onEdit(pot)} aria-label="Изменить">
            <Icon name="edit" size={17} />
          </button>
        )
      }
    >
      {pot && (
        <div className="stack">
          <div className="row" style={{ gap: 16 }}>
            <Ring value={pot.saved / pot.target} size={96} stroke={10} colors={['var(--money)', 'var(--money-2)']}>
              <span className="bold num" style={{ fontSize: 18 }}>
                {Math.min(100, Math.round((pot.saved / pot.target) * 100))}%
              </span>
            </Ring>
            <div className="grow">
              <div style={{ fontSize: 22, fontWeight: 800 }} className="num">
                {fmtMoney(pot.saved, cur)}
              </div>
              <div className="small muted num">из {fmtMoney(pot.target, cur)}</div>
              <div className="tiny muted" style={{ marginTop: 4 }}>
                {pot.saved >= pot.target
                  ? 'Цель достигнута 🎉'
                  : `Осталось ${fmtMoney(pot.target - pot.saved, cur)}${pot.deadline ? ` · до ${humanDay(pot.deadline)}` : ''}${monthly ? ` · по ${fmtMoney(Math.ceil(monthly / 100) * 100, cur)} в мес.` : ''}`}
              </div>
            </div>
          </div>
          <AmountInput value={val} onChange={setVal} cur={cur} />
          <div className="chips" style={{ justifyContent: 'center' }}>
            {[500, 1000, 5000, 10000].map((n) => (
              <button key={n} className="chip" onClick={() => (haptic.select(), setVal(String(parseAmount(val) + n)))}>
                +{n.toLocaleString('ru-RU')}
              </button>
            ))}
          </div>
          <div className="grid-2">
            <button className="btn ghost" disabled={sum <= 0 || sum > pot.saved} onClick={() => move(-1)}>
              Снять
            </button>
            <button className="btn" disabled={sum <= 0} style={{ ['--c1' as string]: 'var(--money)', ['--c2' as string]: 'var(--money-2)' }} onClick={() => move(1)}>
              Пополнить
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

/* ===================== Регулярные платежи ===================== */

export function SubSheet({ open, onClose, sub }: { open: boolean; onClose: () => void; sub?: Sub | null }) {
  const s = useStore();
  const cur = s.fin.currency;
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🔁');
  const [amount, setAmount] = useState('');
  const [dom, setDom] = useState(1);
  const [cat, setCat] = useState('subs');
  const [was, setWas] = useState(false);
  if (open !== was) {
    setWas(open);
    if (open) {
      setName(sub?.name ?? '');
      setEmoji(sub?.emoji ?? '🔁');
      setAmount(sub ? String(sub.amount) : '');
      setDom(sub?.dom ?? new Date().getDate());
      setCat(sub?.cat ?? 'subs');
    }
  }
  const sum = parseAmount(amount);
  return (
    <Sheet open={open} onClose={onClose} title={sub ? 'Изменить платёж' : 'Регулярный платёж'} full>
      <div className="stack">
        {!sub && (
          <div className="chips">
            {SUB_PRESETS.map((p) => (
              <button
                key={p.name}
                className="chip"
                onClick={() => {
                  haptic.select();
                  setName(p.name);
                  setEmoji(p.emoji);
                  setCat(p.cat);
                }}
              >
                {p.emoji} {p.name}
              </button>
            ))}
          </div>
        )}
        <div className="row">
          <EmojiPicker value={emoji} onChange={setEmoji} list={['🔁', '💡', '🌐', '☁️', ...MONEY_EMOJI]} />
          <input className="input" placeholder="Название" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <AmountInput value={amount} onChange={setAmount} cur={cur} />
        <div className="field">
          <label>День месяца</label>
          <Stepper value={dom} min={1} max={31} onChange={setDom} format={(v) => `${v}-го числа`} />
        </div>
        <div className="field">
          <label>Категория</label>
          <div className="chips">
            {catsByUsage(s, 'exp').map((c) => (
              <button key={c.id} className={`chip ${cat === c.id ? 'on' : ''}`} onClick={() => (haptic.select(), setCat(c.id))}>
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
        </div>
        <div className="row">
          {sub && (
            <button
              className="btn danger"
              style={{ width: 56, padding: 0, flexShrink: 0 }}
              aria-label="Удалить"
              onClick={() => {
                s.removeSub(sub.id);
                haptic.warning();
                onClose();
              }}
            >
              <Icon name="trash" size={18} />
            </button>
          )}
          <button
            className="btn"
            disabled={!name.trim() || sum <= 0}
            style={{ ['--c1' as string]: 'var(--money)', ['--c2' as string]: 'var(--money-2)' }}
            onClick={() => {
              const data = { name: name.trim(), emoji, amount: sum, dom, cat };
              if (sub) s.updateSub(sub.id, data);
              else s.addSub(data);
              haptic.success();
              onClose();
            }}
          >
            {sub ? 'Сохранить' : 'Добавить'}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
