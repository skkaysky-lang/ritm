// Оформление бота через Bot API: имя, описания, кнопка меню.
// Запуск: npm run bot:setup  (токен берётся из файла .env, в консоль не печатается)
process.loadEnvFile?.('.env');

const TOKEN = (process.env.BOT_TOKEN || '').trim();
const APP_URL = 'https://skkaysky-lang.github.io/ritm/';

if (!/^\d+:[\w-]{30,}$/.test(TOKEN)) {
  console.error('✗ В файле .env нет токена. Вставь его после BOT_TOKEN= и сохрани файл.');
  process.exit(1);
}

async function api(method, body = {}) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`${method}: ${data.description}`);
  return data.result;
}

const NAME = 'Ритм · сон, еда, привычки';

const SHORT = 'Сон, питание, шаги и привычки в одном месте. Отмечай за секунды, а графики и расчёты я сделаю сам 🌙';

const DESCRIPTION = `🌙 Ритм — твой помощник для здоровых привычек

😴 Сон — жми «Ложусь» и «Проснулся», а я посчитаю длительность, циклы и недосып
🍎 Питание — норма калорий и КБЖУ под твою цель, база продуктов
👟 Шаги и вес — графики, тренд и прогноз до цели
✅ Привычки и цели — серии дней, карта активности, достижения

Нажми «Открыть Ритм» внизу, чтобы начать 👇`;

const onlyCommands = process.argv.includes('--commands');
const allSteps = [
  ['Имя', () => api('setMyName', { name: NAME })],
  ['Короткое описание (в профиле)', () => api('setMyShortDescription', { short_description: SHORT })],
  ['Описание (в пустом чате)', () => api('setMyDescription', { description: DESCRIPTION })],
  ['Кнопка меню', () => api('setChatMenuButton', { menu_button: { type: 'web_app', text: 'Открыть Ритм', web_app: { url: APP_URL } } })],
  [
    'Команды',
    () =>
      api('setMyCommands', {
        commands: [
          { command: 'start', description: 'Начать' },
          { command: 'reminders', description: 'Напоминания' },
          { command: 'help', description: 'Как пользоваться' },
        ],
      }),
  ],
];

const steps = onlyCommands ? allSteps.filter(([l]) => l === 'Команды') : allSteps;
const me = await api('getMe');
console.log(`Бот: @${me.username}\n`);
for (const [label, fn] of steps) {
  try {
    await fn();
    console.log(`✓ ${label}`);
  } catch (e) {
    // setMyName ограничен по частоте — если упёрлись, просто пропускаем
    console.log(`✗ ${label}: ${e.message}`);
  }
}
console.log(`\nГотово: https://t.me/${me.username}`);
