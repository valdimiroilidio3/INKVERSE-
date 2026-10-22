/**
 * CLI: run the studio spatial audit and exit non-zero on any error-level finding.
 * `npm run check:scene`
 */
import { auditStudioScene, summarise } from '../../lib/scene-audit';

const findings = auditStudioScene();
const summary = summarise(findings);

for (const finding of findings) {
  const tag = finding.severity.toUpperCase().padEnd(5);
  console.log(`${tag} ${finding.id.padEnd(28)} ${finding.message}`);
  if (finding.detail && finding.severity !== 'info') console.log(`      ${JSON.stringify(finding.detail)}`);
}

console.log(
  `\n${summary.errors} error(s), ${summary.warnings} warning(s), ${summary.infos} note(s) — ${summary.ok ? 'scene contract holds' : 'SCENE CONTRACT BROKEN'}`,
);
process.exit(summary.ok ? 0 : 1);
