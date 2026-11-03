// Class names like "1ENR1" / "1ENR-1": year of study, spécialité, group.
export function classParts(name: string) {
  const match = name.trim().match(/^(\d+)\s*([A-Za-zÀ-ÿ]+)\s*[-_ ]?\s*(\d*)/);
  if (!match) return { year: null, specialty: null, group: null };
  return {
    year: Number(match[1]),
    specialty: match[2].toUpperCase(),
    group: match[3] ? Number(match[3]) : null,
  };
}
