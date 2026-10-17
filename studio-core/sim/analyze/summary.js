export function compactSummary(results) {
  return {
    seeds: results?.seeds ?? [],
    personas: results?.personas ?? [],
    maxSteps: results?.maxSteps ?? null,
    variants: (results?.variants ?? []).map((variant) => ({
      id: variant.id,
      pacingPath: variant.pacingPath ?? null
    })),
    baseline: results?.comparison?.baseline ?? null,
    metrics: results?.comparison?.metrics ?? {},
    byPersona: results?.comparison?.byPersona ?? {}
  };
}
