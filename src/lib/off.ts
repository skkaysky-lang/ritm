import type { Food } from '../store';

/* Онлайн-поиск по Open Food Facts — открытая база товаров из магазинов.
   Ключ не нужен. Ищем по названию или по штрихкоду (8–14 цифр). */

const BASE = 'https://world.openfoodfacts.org';
const FIELDS = 'code,product_name,product_name_ru,brands,nutriments,serving_quantity';
const cache = new Map<string, Food[]>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toFood(p: any): Food | null {
  const n = p.nutriments || {};
  let kcal = Number(n['energy-kcal_100g']);
  if (!kcal && n.energy_100g) kcal = Number(n.energy_100g) / 4.184;
  const name = String(p.product_name_ru || p.product_name || '').trim();
  if (!name || !kcal || !Number.isFinite(kcal) || kcal > 950) return null;
  const r1 = (v: unknown) => Math.round((Number(v) || 0) * 10) / 10;
  const serving = Number(p.serving_quantity);
  return {
    id: 'off_' + p.code,
    name: name.length > 70 ? name.slice(0, 68) + '…' : name,
    emoji: '🛒',
    brand: String(p.brands || '').split(',')[0].trim() || undefined,
    kcal: Math.round(kcal),
    p: r1(n.proteins_100g),
    f: r1(n.fat_100g),
    c: r1(n.carbohydrates_100g),
    unit: serving > 0 && serving < 2000 ? { name: 'порц.', grams: Math.round(serving) } : undefined,
  };
}

export const isBarcode = (q: string) => /^\d{8,14}$/.test(q.trim());

export async function searchOnline(q: string, signal: AbortSignal): Promise<Food[]> {
  const key = q.trim().toLowerCase();
  const hit = cache.get(key);
  if (hit) return hit;
  let out: Food[] = [];
  if (isBarcode(key)) {
    const r = await fetch(`${BASE}/api/v2/product/${key}.json?fields=${FIELDS}`, { signal });
    const j = await r.json();
    const f = j.product ? toFood({ ...j.product, code: key }) : null;
    if (f) out = [f];
  } else {
    const url = `${BASE}/cgi/search.pl?search_terms=${encodeURIComponent(key)}&search_simple=1&action=process&json=1&page_size=40&lc=ru&fields=${FIELDS}`;
    const j = await (await fetch(url, { signal })).json();
    const seen = new Set<string>();
    for (const p of j.products ?? []) {
      const f = toFood(p);
      if (!f) continue;
      const k = (f.name + '|' + (f.brand ?? '')).toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(f);
      if (out.length >= 25) break;
    }
  }
  cache.set(key, out);
  return out;
}
