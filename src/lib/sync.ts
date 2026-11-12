import { pickData, useStore, type Data } from '../store';
import { cloudLoad, cloudSave } from './telegram';

/* Данные живут в localStorage (мгновенно) и дублируются в облако Telegram,
   чтобы открывались на телефоне и на компьютере одинаково. */

const TS_KEY = 'ritm-updated';
let applyingRemote = false;
let timer: number | undefined;
let saving = false;
let dirty = false;

/** Отправки идут строго по одной: иначе куски двух версий могут перемешаться */
async function flush() {
  if (saving) {
    dirty = true;
    return;
  }
  saving = true;
  try {
    do {
      dirty = false;
      const ts = Number(localStorage.getItem(TS_KEY)) || Date.now();
      await cloudSave(JSON.stringify(pickData(useStore.getState())), ts);
    } while (dirty);
  } catch {
    /* нет связи — отправим при следующем изменении */
  } finally {
    saving = false;
  }
}

export async function startSync() {
  const localTs = Number(localStorage.getItem(TS_KEY) || 0);
  const remote = await cloudLoad();
  // если пользователь уже что-то изменил, пока грузилось облако, — его правки важнее
  const changedMeanwhile = Number(localStorage.getItem(TS_KEY) || 0) !== localTs;
  if (remote && remote.ts > localTs && !changedMeanwhile) {
    try {
      const data = JSON.parse(remote.json) as Partial<Data>;
      applyingRemote = true;
      useStore.getState().importData(data);
      localStorage.setItem(TS_KEY, String(remote.ts));
    } catch {
      /* битые данные в облаке — оставляем локальные */
    } finally {
      applyingRemote = false;
    }
  }
}

// подписка ставится сразу, а не после ответа облака, чтобы не потерять первые правки
useStore.subscribe(() => {
  if (applyingRemote) return;
  localStorage.setItem(TS_KEY, String(Date.now()));
  window.clearTimeout(timer);
  timer = window.setTimeout(flush, 1500);
});
