// Cascading filters: each dropdown only offers the values still present among
// the items that match the OTHER filters (pick a level → only its years,
// semesters, parcours… remain), with the number of items for each value.

export type Facets<T> = Record<string, (item: T) => string | null | undefined>;

function matches<T>(item: T, facets: Facets<T>, selected: Record<string, string>, except?: string) {
  return Object.entries(facets).every(
    ([key, value]) => key === except || !selected[key] || (value(item) ?? "") === selected[key],
  );
}

// Items matching every selected filter.
export function applyFacets<T>(items: T[], facets: Facets<T>, selected: Record<string, string>) {
  return items.filter((item) => matches(item, facets, selected));
}

// Values available for `key` given the other filters, with their counts. The
// current value always stays listed (shown with 0) so it can be changed back.
export function facetOptions<T>(
  items: T[],
  facets: Facets<T>,
  selected: Record<string, string>,
  key: string,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (!matches(item, facets, selected, key)) continue;
    const value = facets[key](item);
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  const current = selected[key];
  if (current && !counts.has(current)) counts.set(current, 0);
  return counts;
}
