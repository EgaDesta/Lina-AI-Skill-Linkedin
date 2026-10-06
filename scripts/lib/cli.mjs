// Shared CLI surface: argument parsing, report rendering, exit codes.
//
// Exit codes are the contract for agents calling these scripts.
//   0  success, no blocking problem
//   1  completed but found problems the human must act on
//   2  bad usage
//   3  could not run at all (missing persona, schema error)

export function parseArgs(argv = process.argv.slice(2)) {
  const out = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') {
      out._.push(...argv.slice(i + 1));
      break;
    }
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      if (eq !== -1) {
        out.flags[arg.slice(2, eq)] = arg.slice(eq + 1);
        continue;
      }
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        out.flags[key] = true;
      } else {
        out.flags[key] = next;
        i++;
      }
      continue;
    }
    out._.push(arg);
  }
  return out;
}

export function usage(lines) {
  return lines.join('\n');
}

/* -------------------------------------------------------------------------- */
/* Rendering                                                                   */
/* -------------------------------------------------------------------------- */

const SYM = {
  blocker: '[BLOCKER]',
  warn: '[WARN]',
  nice: '[NICE]',
  pass: '[ ok ]',
  hard: '[HARD]',
};

function pad(s, n) {
  return String(s).padEnd(n);
}

export function renderReport(report) {
  const L = [];
  const bar = '='.repeat(72);
  L.push(bar);
  L.push(`LINA ${report.kind.toUpperCase()} AUDIT`);
  L.push(`subject: ${report.subject}`);
  L.push(`persona: v${report.persona_version}`);
  L.push(bar);

  const total = report.capped ? `${report.total} (capped)` : `${report.total}`;
  L.push(`SCORE  ${total} / ${report.total_possible}   band: ${report.band}`);
  if (report.capped) L.push(`CAP    ${report.cap_reason}`);
  L.push('');

  L.push('DIMENSIONS');
  for (const d of report.dimensions) {
    const pct = Math.round((d.points_earned / d.points_possible) * 100);
    const mark = d.ratio >= 0.8 ? '.....' : d.ratio >= 0.5 ? '....' : '...';
    L.push(`  ${pad(d.label, 26)} ${pad(`${d.points_earned}/${d.points_possible}`, 9)} ${pad(`${pct}%`, 5)} ${mark}`);
    if (d.question) L.push(`      ${d.question}`);
  }
  L.push('');

  const hard = report.findings.filter((f) => f.hard_block);
  const blockers = report.findings.filter((f) => !f.hard_block && f.severity === 'blocker' && !f.passed);
  const warns = report.findings.filter((f) => !f.hard_block && f.severity === 'warn' && !f.passed);
  const nices = report.findings.filter((f) => !f.hard_block && f.severity === 'nice' && !f.passed);

  const section = (title, findings) => {
    if (!findings.length) return;
    L.push(title);
    for (const f of findings) {
      L.push(`  ${SYM[f.hard_block ? 'hard' : f.severity]} ${f.check_id}  ${f.label}  (${f.points_at_stake} pts)`);
      if (f.measured != null || f.target != null) {
        L.push(`         measured ${fmt(f.measured)}   target ${fmt(f.target)}`);
      }
      if (f.offending) L.push(`         found: ${truncate(f.offending, 160)}`);
      if (f.fix) {
        L.push(`         fix: ${f.fix.action}  [${f.fix.effort}${f.fix.needs_human ? ', needs human' : ''}]`);
        if (f.fix.replacement) L.push(`         try: ${truncate(f.fix.replacement, 200)}`);
        if (f.fix.source_template) L.push(`         from: ${f.fix.source_template}`);
      }
      L.push('');
    }
  };

  section('HARD BLOCKS', hard);
  section('BLOCKERS', blockers);
  section('WARNINGS', warns);
  section('NICES', nices);

  if (report.next_actions?.length) {
    L.push('DO THESE THREE FIRST');
    report.next_actions.slice(0, 3).forEach((a, i) => {
      L.push(`  ${i + 1}. [${a.severity}] ${a.action}  (${a.points_at_stake} pts)${a.playbook ? `  see ${a.playbook}` : ''}`);
    });
    L.push('');
  }

  if (report.stop_conditions?.length) {
    L.push('STOP CONDITIONS TRIPPED');
    for (const s of report.stop_conditions) {
      L.push(`  ${s.id}  ${s.when}`);
      L.push(`    why:    ${s.why}`);
      L.push(`    action: ${s.action}`);
    }
    L.push('');
  }

  if (report.not_scored?.length) {
    L.push('NOT SCORED (human judgement)');
    for (const n of report.not_scored) L.push(`  - ${n}`);
    L.push('');
  }

  const passes = report.findings.filter((f) => f.passed);
  if (passes.length) {
    L.push(`PASSING (${passes.length}): ${passes.map((f) => f.check_id).join(', ')}`);
    L.push('');
  }

  L.push(bar);
  return L.join('\n');
}

export function renderGaps(gaps, blockingCount) {
  const L = [];
  L.push('='.repeat(72));
  L.push('LINA PERSONA VALIDATION');
  L.push('='.repeat(72));
  L.push('');
  if (!gaps.length) {
    L.push('All required persona fields are filled.');
    L.push('');
    return L.join('\n');
  }
  L.push(`${gaps.length} gap(s) found, ${blockingCount} blocking.`);
  L.push('');
  const blockers = gaps.filter((g) => g.blocks);
  const rest = gaps.filter((g) => !g.blocks);
  if (blockers.length) {
    L.push('BLOCKING — Lina cannot generate until these are filled');
    for (const g of blockers) L.push(`  x ${g.where}\n      ${g.id}: ${g.why}`);
    L.push('');
  }
  if (rest.length) {
    L.push('NON-BLOCKING — will reduce scores until filled');
    for (const g of rest) L.push(`  - ${g.where}\n      ${g.id}: ${g.why}`);
    L.push('');
  }
  return L.join('\n');
}

function fmt(v) {
  if (v === null || v === undefined) return '-';
  if (typeof v === 'number') return String(Math.round(v * 1000) / 1000);
  return String(v);
}

export function truncate(s, n) {
  const str = String(s).replace(/\s+/g, ' ').trim();
  return str.length <= n ? str : `${str.slice(0, n - 1)}…`;
}

/** Stable sort: hard blocks first, then severity, then points at stake. */
export function orderFindings(findings) {
  const rank = { blocker: 0, warn: 1, nice: 2 };
  return [...findings].sort((a, b) => {
    if (a.hard_block !== b.hard_block) return a.hard_block ? -1 : 1;
    if (a.passed !== b.passed) return a.passed ? 1 : -1;
    if (a.severity !== b.severity) return (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3);
    return (b.points_at_stake ?? 0) - (a.points_at_stake ?? 0);
  });
}

export function bandFor(score, bands) {
  const list = bands ?? [];
  for (const b of list) {
    if (score >= b.min && score <= b.max) return b.label;
  }
  return 'unclassified';
}

export function bandMeaning(bands, label) {
  return (bands ?? []).find((b) => b.label === label)?.meaning ?? '';
}