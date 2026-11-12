import type { FinCat } from '../store';

const e = (id: string, label: string, emoji: string, color: string): FinCat => ({ id, label, emoji, color, type: 'exp' });
const i = (id: string, label: string, emoji: string, color: string): FinCat => ({ id, label, emoji, color, type: 'inc' });

export const EXP_CATS: FinCat[] = [
  e('food', 'Продукты', '🛒', '#2fd3a4'),
  e('cafe', 'Кафе и доставка', '🍔', '#ff9f43'),
  e('transport', 'Транспорт', '🚌', '#4f8bff'),
  e('home', 'Дом и ЖКХ', '🏠', '#8b7bff'),
  e('phone', 'Связь', '📱', '#43c6f5'),
  e('health', 'Здоровье', '💊', '#ff6b8b'),
  e('clothes', 'Одежда', '👕', '#c86bff'),
  e('fun', 'Развлечения', '🎮', '#ffc04d'),
  e('subs', 'Подписки', '🔁', '#19b3d6'),
  e('edu', 'Образование', '📚', '#7c6cff'),
  e('gifts', 'Подарки', '🎁', '#ff5fa2'),
  e('travel', 'Путешествия', '✈️', '#3ba4ff'),
  e('sport', 'Спорт', '🏋️', '#8bd346'),
  e('beauty', 'Красота', '💅', '#ff8fb1'),
  e('pets', 'Питомцы', '🐾', '#d9a066'),
  e('car', 'Авто', '🚗', '#6a7bff'),
  e('credit', 'Кредиты', '🏦', '#a0a6b8'),
  e('other', 'Другое', '📦', '#8a90a0'),
];

export const INC_CATS: FinCat[] = [
  i('salary', 'Зарплата', '💼', '#2fd3a4'),
  i('side', 'Подработка', '💻', '#4f8bff'),
  i('gift_in', 'Подарок', '🎁', '#ff5fa2'),
  i('cashback', 'Кэшбэк', '💳', '#ffc04d'),
  i('invest', 'Инвестиции', '📈', '#8b7bff'),
  i('sale', 'Продажа', '🏷️', '#ff9f43'),
  i('other_in', 'Другое', '💰', '#8a90a0'),
];

export const CURRENCIES = ['₽', '$', '€', '₸', '₴', 'Br', '₾', 'сум'];

export const CAT_COLORS = ['#2fd3a4', '#ff9f43', '#4f8bff', '#8b7bff', '#ff6b8b', '#ffc04d', '#c86bff', '#43c6f5', '#8bd346', '#ff5fa2'];

export const MONEY_EMOJI = ['📦', '🛒', '🍔', '☕', '🚌', '🚕', '🏠', '📱', '💊', '👕', '🎮', '🎬', '📚', '🎁', '✈️', '🏋️', '💅', '🐾', '🚗', '⛽', '🏦', '🍺', '🚬', '👶', '🛠️', '💻', '🎵', '🧾', '💼', '💰', '📈', '💳'];

export const POT_EMOJI = ['🎯', '✈️', '🏠', '🚗', '💻', '📱', '🎓', '💍', '🏖️', '🛟', '🎸', '🏍️', '👶', '🐶', '🎁', '💰'];

/** Популярные регулярные платежи для быстрого добавления */
export const SUB_PRESETS: { name: string; emoji: string; cat: string }[] = [
  { name: 'Аренда', emoji: '🏠', cat: 'home' },
  { name: 'ЖКХ', emoji: '💡', cat: 'home' },
  { name: 'Интернет', emoji: '🌐', cat: 'phone' },
  { name: 'Мобильная связь', emoji: '📱', cat: 'phone' },
  { name: 'Кредит', emoji: '🏦', cat: 'credit' },
  { name: 'Музыка', emoji: '🎵', cat: 'subs' },
  { name: 'Кино и сериалы', emoji: '🎬', cat: 'subs' },
  { name: 'Спортзал', emoji: '🏋️', cat: 'sport' },
  { name: 'Облако', emoji: '☁️', cat: 'subs' },
];
