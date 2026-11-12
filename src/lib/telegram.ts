/* Тонкая обёртка над Telegram WebApp API. Вне Telegram всё молча отключается,
   так что приложение можно открыть и в обычном браузере. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tg: any = (window as any).Telegram?.WebApp;

export const inTelegram: boolean = !!tg && !!tg.initData;

const atLeast = (v: string) => inTelegram && !!tg.isVersionAtLeast?.(v);

export function initTelegram(bg: string) {
  if (!inTelegram) return;
  tg.ready();
  tg.expand();
  if (atLeast('7.7')) tg.disableVerticalSwipes?.();
  if (atLeast('6.1')) {
    tg.setHeaderColor?.(bg);
    tg.setBackgroundColor?.(bg);
  }
  if (atLeast('7.10')) tg.setBottomBarColor?.(bg);
}

export function setTelegramColors(bg: string) {
  if (!atLeast('6.1')) return;
  tg.setHeaderColor?.(bg);
  tg.setBackgroundColor?.(bg);
  if (atLeast('7.10')) tg.setBottomBarColor?.(bg);
}

export function telegramScheme(): 'dark' | 'light' | null {
  return inTelegram ? (tg.colorScheme === 'light' ? 'light' : 'dark') : null;
}

export function onThemeChange(cb: () => void) {
  if (inTelegram) tg.onEvent('themeChanged', cb);
}

export function telegramUserName(): string {
  return inTelegram ? tg.initDataUnsafe?.user?.first_name ?? '' : '';
}

export const haptic = {
  light: () => atLeast('6.1') && tg.HapticFeedback.impactOccurred('light'),
  medium: () => atLeast('6.1') && tg.HapticFeedback.impactOccurred('medium'),
  heavy: () => atLeast('6.1') && tg.HapticFeedback.impactOccurred('heavy'),
  soft: () => atLeast('6.1') && tg.HapticFeedback.impactOccurred('soft'),
  select: () => atLeast('6.1') && tg.HapticFeedback.selectionChanged(),
  success: () => atLeast('6.1') && tg.HapticFeedback.notificationOccurred('success'),
  warning: () => atLeast('6.1') && tg.HapticFeedback.notificationOccurred('warning'),
  error: () => atLeast('6.1') && tg.HapticFeedback.notificationOccurred('error'),
};

/* ---------- Системная кнопка «Назад» (стек обработчиков для шторок) ---------- */

const backStack: Array<() => void> = [];
let backBound = false;

function refreshBack() {
  if (!atLeast('6.1')) return;
  if (!backBound) {
    tg.BackButton.onClick(() => backStack[backStack.length - 1]?.());
    backBound = true;
  }
  if (backStack.length) tg.BackButton.show();
  else tg.BackButton.hide();
}

export function pushBack(fn: () => void): () => void {
  backStack.push(fn);
  refreshBack();
  return () => {
    const i = backStack.lastIndexOf(fn);
    if (i >= 0) backStack.splice(i, 1);
    refreshBack();
  };
}

export const BOT_USERNAME = 'ritmapp1bot';

/** Открывает чат с ботом на экране настройки напоминаний */
export function openReminders() {
  const url = `https://t.me/${BOT_USERNAME}?start=reminders`;
  if (atLeast('6.1')) tg.openTelegramLink(url);
  else window.open(url, '_blank');
}

export async function confirmDialog(text: string): Promise<boolean> {
  if (atLeast('6.2')) {
    return new Promise((res) => tg.showConfirm(text, (ok: boolean) => res(ok)));
  }
  return window.confirm(text);
}

/* ---------- Облачное хранилище Telegram (синхронизация между устройствами) ---------- */

const CHUNK = 3500; // лимит значения — 4096 символов, берём с запасом
const cloudOk = () => atLeast('6.9') && !!tg.CloudStorage;

function cs<T>(method: string, ...args: unknown[]): Promise<T> {
  return new Promise((resolve, reject) => {
    tg.CloudStorage[method](...args, (err: unknown, val: T) => (err ? reject(err) : resolve(val)));
  });
}

// что мы сами отправили в прошлый раз — чтобы не переписывать неизменившиеся куски
let sentChunks: string[] = [];
let sentTs = '';

export async function cloudSave(json: string, ts: number): Promise<void> {
  if (!cloudOk()) return;
  const parts: string[] = [];
  for (let i = 0; i < json.length; i += CHUNK) parts.push(json.slice(i, i + CHUNK));
  const prev = Number((await cs<string>('getItem', 'n').catch(() => '0')) || 0);
  // пропускать куски можно, только если в облаке лежит именно наша прошлая запись
  const remoteTs = await cs<string>('getItem', 't').catch(() => '');
  const mine = sentTs !== '' && remoteTs === sentTs;
  for (let i = 0; i < parts.length; i++) {
    if (mine && sentChunks[i] === parts[i]) continue;
    await cs('setItem', `c${i}`, parts[i]);
  }
  if (prev > parts.length) {
    const stale = Array.from({ length: prev - parts.length }, (_, i) => `c${parts.length + i}`);
    await cs('removeItems', stale).catch(() => undefined);
  }
  await cs('setItem', 'n', String(parts.length));
  await cs('setItem', 't', String(ts));
  sentChunks = parts;
  sentTs = String(ts);
}

export async function cloudLoad(): Promise<{ json: string; ts: number } | null> {
  if (!cloudOk()) return null;
  try {
    const meta = await cs<Record<string, string>>('getItems', ['n', 't']);
    const n = Number(meta.n || 0);
    if (!n) return null;
    const keys = Array.from({ length: n }, (_, i) => `c${i}`);
    const vals = await cs<Record<string, string>>('getItems', keys);
    return { json: keys.map((k) => vals[k] ?? '').join(''), ts: Number(meta.t || 0) };
  } catch {
    return null;
  }
}
