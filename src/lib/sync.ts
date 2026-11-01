import { pickData, useStore, type Data } from '../store';
import { cloudLoad, cloudSave } from './telegram';

/* Данные живут в localStorage (мгновенно) и дублируются в облако Telegram,
   чтобы открывались на телефоне и на компьютере одинаково. */

const TS_KEY = 'ritm-updated';
let applyingRemote = false;
let timer: number | undefined;

export async function startSync() {
  const localTs = Number(localStorage.getItem(TS_KEY) || 0);
  const remote = await cloudLoad();
  if (remote && remote.ts > localTs) {
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

  useStore.subscribe(() => {
    if (applyingRemote) return;
    const ts = Date.now();
    localStorage.setItem(TS_KEY, String(ts));
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      cloudSave(JSON.stringify(pickData(useStore.getState())), ts).catch(() => undefined);
    }, 1500);
  });
}
