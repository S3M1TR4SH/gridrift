function tallyQuitReasons(sessions = []) {
  const counts = { frustration: 0, boredom: 0, ad: 0, game_over: 0, safety_cap: 0 };
  for (const session of sessions) {
    if (session?.anomaly === 'safety_cap') counts.safety_cap += 1;
    else if (Object.hasOwn(counts, session?.quitReason)) counts[session.quitReason] += 1;
  }
  return counts;
}

export function compactSummary(results) {
  return {
    seeds: results?.seeds ?? [],
    personas: results?.personas ?? [],
    maxSteps: results?.maxSteps ?? null,
    quitReasons: tallyQuitReasons(results?.sessions),
    variants: (results?.variants ?? []).map((variant) => ({
      id: variant.id,
      pacingPath: variant.pacingPath ?? null
    })),
    baseline: results?.comparison?.baseline ?? null,
    metrics: results?.comparison?.metrics ?? {},
    byPersona: results?.comparison?.byPersona ?? {}
  };
}
