import type { Category } from './types';

interface CategoryMeta {
  label: string;
  emoji: string;
  /** Two hues for the generated cover gradient. */
  from: string;
  to: string;
}

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  social: { label: 'Social', emoji: '🥂', from: '#ff8a5b', to: '#ff4f7b' },
  tech: { label: 'Tech', emoji: '💻', from: '#5b7cff', to: '#8a5bff' },
  music: { label: 'Music', emoji: '🎷', from: '#b64cff', to: '#ff5ab4' },
  food: { label: 'Food & Drink', emoji: '🍜', from: '#ffb23f', to: '#ff6a3d' },
  sports: { label: 'Sports', emoji: '⚽', from: '#1fc28b', to: '#16a3c9' },
  arts: { label: 'Arts', emoji: '🎨', from: '#ff6f91', to: '#ffc75f' },
  outdoors: { label: 'Outdoors', emoji: '🏞️', from: '#3fb96b', to: '#9ccc3d' },
  other: { label: 'Other', emoji: '✨', from: '#8e8a86', to: '#5d6b82' },
};

export const coverStyle = (c: Category) => ({
  backgroundImage: `linear-gradient(135deg, ${CATEGORY_META[c].from}, ${CATEGORY_META[c].to})`,
});
