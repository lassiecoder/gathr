import { CATEGORY_META } from '../lib/categories';
import type { Category } from '../lib/types';

export function CategoryPill({ category }: { category: Category }) {
  const meta = CATEGORY_META[category];
  return (
    <span className="pill">
      <span aria-hidden>{meta.emoji}</span> {meta.label}
    </span>
  );
}
