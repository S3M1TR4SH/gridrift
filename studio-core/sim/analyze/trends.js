function cell(block) {
  if (!block || block.baseline == null) return '';
  const deltas = Object.entries(block.delta ?? {})
    .map(([id, value]) => `${id} ${value > 0 ? '+' : ''}${value}`);
  return [block.baseline, ...deltas].join(' ');
}

export function formatTrends(entries) {
  const lines = [
    '# Simulation trends',
    '',
    `${entries.length} run${entries.length === 1 ? '' : 's'}.`,
    '',
    '| When | Git | Would-return | Clears | Ad moments | Quit rate | Accepted | Rejected |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |'
  ];
  for (const entry of entries) {
    const summary = entry.resultsSummary ?? {};
    lines.push(`| ${entry.timestamp} | ${entry.gitSha || ''} | ${cell(summary.wouldReturn)} | ${cell(summary.clears)} | ${cell(summary.adMoments)} | ${cell(summary.quitRate)} | ${entry.accepted?.length ?? 0} | ${entry.rejected?.length ?? 0} |`);
  }
  lines.push('');
  return lines.join('\n');
}
