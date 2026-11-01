import type { Habit } from '../store';

export const HABIT_COLORS = ['#7c6cff', '#4f8bff', '#2fd3a4', '#19b3d6', '#ffb020', '#ff9f43', '#ff6b8b', '#c86bff', '#8bd346', '#a0a6b8'];

export const HABIT_EMOJI = [
  '💧', '🏃', '🧘', '📚', '🏋️', '🚶', '🍎', '🥗', '💊', '🛌', '🌅', '🧠', '✍️', '🎯', '🇬🇧', '🎸',
  '🚭', '🍬', '📵', '🧴', '🦷', '🚿', '🧹', '💰', '🙏', '🌿', '🐕', '☀️', '🎨', '💻', '🫁', '❤️',
];

const ALL = [0, 1, 2, 3, 4, 5, 6];
const WORK = [0, 1, 2, 3, 4];

export type HabitTemplate = Omit<Habit, 'id' | 'createdAt'>;

export const HABIT_TEMPLATES: HabitTemplate[] = [
  { name: 'Зарядка', emoji: '🏃', color: '#ff9f43', days: ALL, target: 1, unit: '' },
  { name: 'Медитация', emoji: '🧘', color: '#c86bff', days: ALL, target: 1, unit: '' },
  { name: 'Чтение', emoji: '📚', color: '#4f8bff', days: ALL, target: 20, unit: 'стр' },
  { name: 'Тренировка', emoji: '🏋️', color: '#ff6b8b', days: [0, 2, 4], target: 1, unit: '' },
  { name: 'Прогулка', emoji: '🚶', color: '#2fd3a4', days: ALL, target: 30, unit: 'мин' },
  { name: 'Без сладкого', emoji: '🍬', color: '#ffb020', days: ALL, target: 1, unit: '' },
  { name: 'Витамины', emoji: '💊', color: '#19b3d6', days: ALL, target: 1, unit: '' },
  { name: 'Без телефона перед сном', emoji: '📵', color: '#7c6cff', days: ALL, target: 1, unit: '' },
  { name: 'Подъём без будильника', emoji: '🌅', color: '#ff9f43', days: ALL, target: 1, unit: '' },
  { name: 'Английский', emoji: '🇬🇧', color: '#4f8bff', days: WORK, target: 15, unit: 'мин' },
  { name: 'Дневник', emoji: '✍️', color: '#a0a6b8', days: ALL, target: 1, unit: '' },
  { name: 'Овощи в каждом приёме', emoji: '🥗', color: '#8bd346', days: ALL, target: 3, unit: 'раз' },
  { name: 'Не курить', emoji: '🚭', color: '#ff6b8b', days: ALL, target: 1, unit: '' },
  { name: 'Растяжка', emoji: '🌿', color: '#2fd3a4', days: ALL, target: 10, unit: 'мин' },
  { name: 'Уход за кожей', emoji: '🧴', color: '#c86bff', days: ALL, target: 1, unit: '' },
  { name: 'Откладывать деньги', emoji: '💰', color: '#8bd346', days: ALL, target: 1, unit: '' },
];
