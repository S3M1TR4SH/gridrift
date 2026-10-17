export function formatAnalysis(analysis) {
  const accepted = analysis.accepted ?? [];
  const rejected = analysis.rejected ?? [];
  const lines = [
    '# Config proposals',
    '',
    `Model ${analysis.model || 'unknown'}. ${accepted.length} accepted, ${rejected.length} rejected.`,
    analysis.repaired ? 'The model response needed one repair pass.' : 'The model response matched the schema on the first try.',
    '',
    '## Accepted',
    ''
  ];
  if (!accepted.length) lines.push('None.', '');
  for (const proposal of accepted) {
    lines.push(
      `### ${proposal.rank}. ${proposal.title}`,
      '',
      proposal.rationale,
      '',
      `Expected: ${proposal.expectedEffect}`,
      '',
      `Patch (\`${proposal.config}\`):`,
      '',
      '```json',
      JSON.stringify(proposal.patch, null, 2),
      '```',
      ''
    );
    if (proposal.estimate) {
      lines.push('Sim estimate:', '', '```json', JSON.stringify(proposal.estimate, null, 2), '```', '');
    }
  }
  lines.push('## Rejected', '');
  if (!rejected.length) lines.push('None.', '');
  for (const proposal of rejected) {
    const name = proposal.id || proposal.title || 'response';
    lines.push(`- ${name}: ${proposal.reason}`);
  }
  lines.push('');
  return lines.join('\n');
}
