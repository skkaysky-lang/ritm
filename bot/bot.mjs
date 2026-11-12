// Бот «Ритм»: приветствие, настройка напоминаний кнопками и рассылка по расписанию.
// Без зависимостей, Node 20+. Запуск: npm run bot  (или bot\start-bot.bat)
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
try {
  process.loadEnvFile(join(ROOT, '.env'));
} catch {
  /* нет .env — проверим ниже */
}
const TOKEN = (process.env.BOT_TOKEN || '').trim();
if (!/^\d+:[\w-]{30,}$/.test(TOKEN)) {
  console.error('Нет токена: вставь его в .env после BOT_TOKEN=');
  process.exit(1);
}

const APP_URL = 'https://skkaysky-lang.github.io/ritm/';
const DB_FILE = join(ROOT, 'bot', 'data', 'users.json');
const AVATAR = join(ROOT, 'bot', 'avatar.png');
const DEFAULT_TZ = -new Date().getTimezoneOffset(); // минуты от UTC, как на этом компьютере

/* ===================== Хранилище ===================== */

let db = { users: {}, meta: {} };
if (existsSync(DB_FILE)) {
  try {
    db = JSON.parse(readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    console.error('Не удалось прочитать users.json, начинаю с пустой базы', e.message);
  }
}
let saveTimer;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    mkdirSync(dirname(DB_FILE), { recursive: true });
    writeFileSync(DB_FILE + '.tmp', JSON.stringify(db, null, 1));
    renameSync(DB_FILE + '.tmp', DB_FILE);
  }, 300);
}

/* ===================== Напоминания ===================== */

const REM = {
  morning: { emoji: '🌅', title: 'Утро', hint: 'Отметить подъём и оценить, как спалось', time: '08:00', on: true },
  food: { emoji: '🍽️', title: 'Обед', hint: 'Записать, что съел, пока помнишь', time: '14:00', on: false },
  habits: { emoji: '✅', title: 'Привычки', hint: 'Вечерняя проверка привычек и еды за день', time: '21:00', on: true },
  money: { emoji: '💸', title: 'Расходы', hint: 'Записать траты за день, пока помнишь', time: '21:30', on: false },
  bedtime: { emoji: '🌙', title: 'Отбой', hint: 'Напомню отложить телефон и готовиться ко сну', time: '23:00', on: true },
  weekly: { emoji: '📊', title: 'Итоги недели', hint: 'По воскресеньям: загляни в «Прогресс»', time: '19:00', on: true },
};
const KEYS = Object.keys(REM);
const WATER_FROM = 10;
const WATER_TO = 20;

const TEXTS = {
  morning: [
    '☀️ Доброе утро, {name}! Нажми «Я проснулся» и оцени сон — я посчитаю, сколько ты спал.',
    '🌅 Новый день! Как спалось? Отметь подъём в Ритме.',
    '☕ С добрым утром! Стакан воды, отметка сна — и день начат правильно.',
  ],
  food: ['🍽️ Время обеда! Запиши, что съел, пока помнишь.', '🥗 Обед уже был? Добавь его в дневник — это 10 секунд.', '🍲 Не забудь записать обед, чтобы видеть точный остаток калорий.'],
  habits: [
    '✅ Вечерняя проверка: какие привычки сегодня выполнены? И вся ли еда записана?',
    '🔥 Не дай серии прерваться — отметь привычки за сегодня.',
    '🌆 День почти позади. Загляни в Ритм и отметь, что успел.',
  ],
  money: ['💸 Что сегодня покупал? Запиши траты, пока помнишь: это меньше минуты.', '🧾 Вечерний учёт: внеси расходы за день и посмотри, сколько можно потратить завтра.', '💰 Минутка для финансов: запиши сегодняшние траты.'],
  bedtime: [
    '🌙 Скоро пора спать. Отложи телефон, а в кровати нажми «Ложусь».',
    '😴 Время готовиться ко сну. Хороший сон — основа всего остального.',
    '🛏️ Через полчаса отбой. Приглуши свет и убери экраны.',
  ],
  weekly: ['📊 Неделя позади! В «Прогрессе» ждут итоги, выводы и, может быть, новые достижения 🏆', '🗓️ Воскресенье — время подвести итоги. Загляни в «Прогресс»: как прошла неделя?'],
  water: ['💧 Глоток воды? Выпей стакан и отметь в приложении.', '💧 Напоминаю про воду. Стакан прямо сейчас — отличная идея.', '🚰 Пора попить воды!'],
};
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function user(from, chatId) {
  let u = db.users[chatId];
  if (!u) {
    u = db.users[chatId] = {
      id: chatId,
      name: from?.first_name ?? '',
      tz: DEFAULT_TZ,
      rem: Object.fromEntries(KEYS.map((k) => [k, { on: REM[k].on, time: REM[k].time }])),
      water: { on: false, every: 2 },
      sent: {},
      snooze: [],
      createdAt: Date.now(),
    };
    save();
  }
  if (from?.first_name) u.name = from.first_name;
  // у тех, кто начал раньше, может не быть новых напоминаний — добавляем с настройками по умолчанию
  for (const k of KEYS) u.rem[k] ??= { on: REM[k].on, time: REM[k].time };
  u.blocked = false;
  return u;
}

/* ===================== Время ===================== */

const pad = (n) => String(n).padStart(2, '0');
const toMin = (hm) => {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
};
const toHM = (min) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
};
function localNow(tz) {
  const d = new Date(Date.now() + tz * 60_000);
  return { min: d.getUTCHours() * 60 + d.getUTCMinutes(), day: d.toISOString().slice(0, 10), wd: d.getUTCDay() };
}
const tzLabel = (tz) => `UTC${tz >= 0 ? '+' : '−'}${Math.abs(tz / 60)}`;

/* ===================== Telegram API ===================== */

async function api(method, body = {}) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) {
    const err = new Error(`${method}: ${data.description}`);
    err.code = data.error_code;
    throw err;
  }
  return data.result;
}

const appBtn = (text = '🌙 Открыть Ритм') => ({ text, web_app: { url: APP_URL } });

async function send(chatId, text, keyboard) {
  try {
    return await api('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', reply_markup: keyboard ? { inline_keyboard: keyboard } : undefined });
  } catch (e) {
    if (e.code === 403 && db.users[chatId]) {
      db.users[chatId].blocked = true; // пользователь остановил бота
      save();
    } else console.error(e.message);
  }
}

async function edit(msg, text, keyboard) {
  try {
    await api('editMessageText', { chat_id: msg.chat.id, message_id: msg.message_id, text, parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } });
  } catch (e) {
    if (!/not modified/.test(e.message)) await send(msg.chat.id, text, keyboard);
  }
}

async function sendWelcome(u) {
  const caption =
    `Привет${u.name ? `, ${esc(u.name)}` : ''}! 👋\n\n` +
    `Я <b>Ритм</b> — помощник для сна, питания и хороших привычек.\n\n` +
    `🌙 <b>Приложение</b> — кнопка ниже. Там сон, КБЖУ, шаги, вес, привычки и цели.\n` +
    `🔔 <b>Напоминания</b> — буду писать, когда пора спать, записать еду или отметить привычки.\n\n` +
    `Уже включил утро, вечернюю проверку, отбой и итоги недели. Настроить — /reminders`;
  const kb = { inline_keyboard: [[appBtn()], [{ text: '🔔 Настроить напоминания', callback_data: 'm' }]] };
  try {
    if (db.meta.photoId) {
      await api('sendPhoto', { chat_id: u.id, photo: db.meta.photoId, caption, parse_mode: 'HTML', reply_markup: kb });
    } else {
      const fd = new FormData();
      fd.append('chat_id', String(u.id));
      fd.append('caption', caption);
      fd.append('parse_mode', 'HTML');
      fd.append('reply_markup', JSON.stringify(kb));
      fd.append('photo', new Blob([readFileSync(AVATAR)], { type: 'image/png' }), 'ritm.png');
      const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendPhoto`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!data.ok) throw new Error(data.description);
      db.meta.photoId = data.result.photo.at(-1).file_id;
      save();
    }
  } catch (e) {
    console.error('Фото не отправилось:', e.message);
    await send(u.id, caption, kb.inline_keyboard);
  }
}

const esc = (s) => String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]);

/* ===================== Экраны настроек ===================== */

function mainScreen(u) {
  const now = localNow(u.tz);
  const rows = KEYS.map((k) => {
    const r = u.rem[k];
    return [{ text: `${r.on ? '🟢' : '⚪'} ${REM[k].emoji} ${REM[k].title} · ${r.time}${k === 'weekly' ? ' вс' : ''}`, callback_data: `r:${k}` }];
  });
  rows.push([{ text: `${u.water.on ? '🟢' : '⚪'} 💧 Вода · каждые ${u.water.every} ч`, callback_data: 'w' }]);
  rows.push([{ text: `🕐 Часовой пояс: ${tzLabel(u.tz)} (у тебя ${toHM(now.min)})`, callback_data: 'tz' }]);
  rows.push([appBtn()]);
  const text = `🔔 <b>Напоминания</b>\n\nНажми на напоминание, чтобы включить его или поменять время.\n🟢 включено · ⚪ выключено`;
  return [text, rows];
}

function remScreen(u, k) {
  const r = u.rem[k];
  const d = REM[k];
  const text = `${d.emoji} <b>${d.title}</b>\n${d.hint}\n\nСтатус: ${r.on ? '🟢 включено' : '⚪ выключено'}\nВремя: <b>${r.time}</b>${k === 'weekly' ? ' по воскресеньям' : ''}`;
  const rows = [
    [{ text: r.on ? '🔕 Выключить' : '🔔 Включить', callback_data: `t:${k}` }],
    [
      { text: '−1 ч', callback_data: `s:${k}:-60` },
      { text: '−15 м', callback_data: `s:${k}:-15` },
      { text: '+15 м', callback_data: `s:${k}:15` },
      { text: '+1 ч', callback_data: `s:${k}:60` },
    ],
    [{ text: '👀 Прислать пример', callback_data: `p:${k}` }],
    [{ text: '« Назад', callback_data: 'm' }],
  ];
  return [text, rows];
}

function waterScreen(u) {
  const times = [];
  for (let h = WATER_FROM; h <= WATER_TO; h += u.water.every) times.push(`${pad(h)}:00`);
  const text = `💧 <b>Вода</b>\nНапоминаю попить воды в течение дня.\n\nСтатус: ${u.water.on ? '🟢 включено' : '⚪ выключено'}\nВремя: ${times.join(', ')}`;
  const rows = [
    [{ text: u.water.on ? '🔕 Выключить' : '🔔 Включить', callback_data: 'wt' }],
    [1, 2, 3].map((h) => ({ text: `${u.water.every === h ? '● ' : ''}каждые ${h} ч`, callback_data: `we:${h}` })),
    [{ text: '« Назад', callback_data: 'm' }],
  ];
  return [text, rows];
}

function tzScreen(u) {
  const now = localNow(u.tz);
  const text = `🕐 <b>Часовой пояс</b>\n\nСейчас: <b>${tzLabel(u.tz)}</b>, у тебя должно быть <b>${toHM(now.min)}</b>.\nЕсли время не совпадает с часами, поправь пояс.`;
  const rows = [
    [
      { text: '−1 ч', callback_data: 'z:-60' },
      { text: '+1 ч', callback_data: 'z:60' },
    ],
    [{ text: '« Назад', callback_data: 'm' }],
  ];
  return [text, rows];
}

function reminderKeyboard(k) {
  if (k === 'bedtime') return [[{ text: '😴 Ещё 15 минут', callback_data: 'zz:15' }], [appBtn('🌙 Открыть Ритм')]];
  return [[appBtn()]];
}

/* ===================== Обработка входящих ===================== */

async function onMessage(m) {
  if (m.chat.type !== 'private') return;
  const u = user(m.from, m.chat.id);
  const text = (m.text || '').trim();
  if (text.startsWith('/start')) {
    if (text.includes('reminders')) return send(u.id, ...mainScreen(u));
    return sendWelcome(u);
  }
  if (text.startsWith('/reminders')) return send(u.id, ...mainScreen(u));
  if (text.startsWith('/help'))
    return send(
      u.id,
      `ℹ️ <b>Как пользоваться</b>\n\n` +
        `• Всё отмечается в приложении: кнопка «Открыть Ритм» внизу слева.\n` +
        `• Сон: вечером «Ложусь», утром «Я проснулся».\n` +
        `• Еда: «Питание» → «+» у приёма пищи, поиск по базе или КБЖУ вручную.\n` +
        `• Шаги переписывай из «Здоровья» или с часов.\n\n` +
        `/reminders — настроить напоминания`,
      [[appBtn()]],
    );
  return send(u.id, 'Всё самое интересное — в приложении 👇\nА напоминания настраиваются командой /reminders', [[appBtn()]]);
}

async function onCallback(q) {
  const msg = q.message;
  const u = user(q.from, msg.chat.id);
  const [a, b, c] = q.data.split(':');
  let toast = '';
  let screen = null;

  if (a === 'm') screen = mainScreen(u);
  else if (a === 'r') screen = remScreen(u, b);
  else if (a === 't') {
    u.rem[b].on = !u.rem[b].on;
    toast = u.rem[b].on ? 'Включено' : 'Выключено';
    screen = remScreen(u, b);
  } else if (a === 's') {
    u.rem[b].time = toHM(toMin(u.rem[b].time) + Number(c));
    delete u.sent[b]; // новое время сработает уже сегодня
    toast = u.rem[b].time;
    screen = remScreen(u, b);
  } else if (a === 'p') {
    await send(u.id, pick(TEXTS[b]).replace('{name}', esc(u.name)), reminderKeyboard(b));
    toast = 'Вот так будет выглядеть';
  } else if (a === 'w') screen = waterScreen(u);
  else if (a === 'wt') {
    u.water.on = !u.water.on;
    toast = u.water.on ? 'Включено' : 'Выключено';
    screen = waterScreen(u);
  } else if (a === 'we') {
    u.water.every = Number(b);
    screen = waterScreen(u);
  } else if (a === 'tz') screen = tzScreen(u);
  else if (a === 'z') {
    u.tz = Math.max(-720, Math.min(840, u.tz + Number(b)));
    u.sent = {};
    screen = tzScreen(u);
  } else if (a === 'zz') {
    u.snooze.push({ at: Date.now() + Number(b) * 60_000, kind: 'bedtime' });
    toast = `Напомню через ${b} минут`;
  }

  save();
  await api('answerCallbackQuery', { callback_query_id: q.id, text: toast || undefined }).catch(() => undefined);
  if (screen) {
    if (msg.photo) await send(u.id, ...screen); // из приветствия с фото — новым сообщением
    else await edit(msg, ...screen);
  }
}

/* ===================== Планировщик ===================== */

async function tick() {
  for (const u of Object.values(db.users)) {
    if (u.blocked) continue;
    const now = localNow(u.tz);
    const due = (key, at) => {
      // окно 10 минут, чтобы не пропустить напоминание после перезапуска
      if (now.min < at || now.min >= at + 10 || u.sent[key] === now.day) return false;
      u.sent[key] = now.day;
      save();
      return true;
    };
    for (const k of KEYS) {
      const r = u.rem[k];
      if (!r?.on) continue;
      if (k === 'weekly' && now.wd !== 0) continue;
      if (due(k, toMin(r.time))) await send(u.id, pick(TEXTS[k]).replace('{name}', esc(u.name)), reminderKeyboard(k));
    }
    if (u.water.on) {
      for (let h = WATER_FROM; h <= WATER_TO; h += u.water.every) {
        if (due(`water${h}`, h * 60)) await send(u.id, pick(TEXTS.water), [[appBtn()]]);
      }
    }
    const ready = u.snooze.filter((s) => s.at <= Date.now());
    if (ready.length) {
      u.snooze = u.snooze.filter((s) => s.at > Date.now());
      save();
      for (const s of ready) await send(u.id, '⏰ 15 минут прошли. Пора в кровать — и не забудь нажать «Ложусь» 🌙', [[appBtn()]]);
    }
  }
}

/* ===================== Запуск ===================== */

const me = await api('getMe');
console.log(`[${new Date().toLocaleString('ru-RU')}] Бот @${me.username} запущен. Пользователей: ${Object.keys(db.users).length}`);
setInterval(() => tick().catch((e) => console.error('tick:', e.message)), 20_000);
tick().catch(() => undefined);

let offset = 0;
for (;;) {
  try {
    const updates = await api('getUpdates', { offset, timeout: 30, allowed_updates: ['message', 'callback_query'] });
    for (const up of updates) {
      offset = up.update_id + 1;
      try {
        if (up.message) await onMessage(up.message);
        else if (up.callback_query) await onCallback(up.callback_query);
      } catch (e) {
        console.error('Ошибка обработки:', e.message);
      }
    }
  } catch (e) {
    console.error('Нет связи с Telegram, повтор через 5 с:', e.message);
    await new Promise((r) => setTimeout(r, 5000));
  }
}
