/**
 * Re-order a flat category list so each parent is immediately followed by
 * its subs. Useful for rendering dropdowns / lists that don't support
 * nested groups but want to preserve the parent → sub relationship.
 *
 * Generic over the row shape because some callers (e.g. import-wizard) use
 * a `Pick<Category, ...>` projection rather than the full row.
 */
export function sortByHierarchy<T extends { id: string; parent_id: string | null }>(
  flat: T[],
): T[] {
  const subsByParent = new Map<string, T[]>();
  const roots: T[] = [];
  for (const c of flat) {
    if (c.parent_id) {
      if (!subsByParent.has(c.parent_id))
        subsByParent.set(c.parent_id, []);
      subsByParent.get(c.parent_id)!.push(c);
    } else {
      roots.push(c);
    }
  }
  const out: T[] = [];
  for (const root of roots) {
    out.push(root);
    const subs = subsByParent.get(root.id);
    if (subs) out.push(...subs);
  }
  // Subs without a known parent get appended at the end so nothing's lost.
  for (const [parentId, subs] of subsByParent) {
    if (!roots.some((r) => r.id === parentId)) out.push(...subs);
  }
  return out;
}
