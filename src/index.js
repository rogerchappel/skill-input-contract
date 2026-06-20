import fs from 'node:fs';

const SIDE_EFFECT_WORDS = ['send', 'post', 'publish', 'delete', 'write', 'push', 'merge', 'email', 'notify', 'upload'];
const APPROVAL_WORDS = ['approval', 'confirm', 'permission', 'authorize', 'consent'];

export function parseTaskBrief(text, source = 'inline') {
  const normalized = String(text || '').replace(/\r\n/g, '\n');
  if (!normalized.trim()) throw new Error('Task brief is empty');
  if (source.endsWith('.json')) return normalizeContract(JSON.parse(normalized), source);

  const sections = splitSections(normalized);
  const title = firstHeading(normalized) || basename(source);
  const allBullets = collectBullets(sections);
  const outcome = findFirst(sections, ['outcome', 'goal', 'mission', 'summary']) || firstParagraph(normalized) || title;
  const inputs = collectNamed(sections, ['inputs', 'context', 'required inputs', 'available context']);
  const constraints = collectNamed(sections, ['constraints', 'limits', 'requirements', 'safety']);
  const requestedActions = collectNamed(sections, ['actions', 'tasks', 'workflow', 'steps', 'mvp']);
  const verification = collectNamed(sections, ['verification', 'checks', 'done', 'acceptance criteria']);
  const openQuestions = collectQuestions(normalized, allBullets);
  const sideEffects = detectSideEffects([...requestedActions, ...allBullets, outcome]);
  const approvals = constraints.filter(item => APPROVAL_WORDS.some(word => item.toLowerCase().includes(word)));

  return normalizeContract({
    source,
    title,
    outcome,
    inputs,
    constraints,
    requestedActions,
    sideEffects,
    approvalsRequired: approvals,
    openQuestions,
    verification,
    missing: []
  }, source);
}

export function loadTaskBrief(path) {
  return parseTaskBrief(fs.readFileSync(path, 'utf8'), path);
}

export function validateContract(contract) {
  const findings = [];
  if (!contract.outcome || contract.outcome.length < 8) findings.push(fail('missing_outcome', 'No clear requested outcome was found.'));
  if (contract.inputs.length === 0) findings.push(warn('missing_inputs', 'No explicit inputs were listed.'));
  if (contract.verification.length === 0) findings.push(warn('missing_verification', 'No verification workflow was listed.'));
  if (contract.sideEffects.length > 0 && contract.approvalsRequired.length === 0) {
    findings.push(fail('approval_gap', 'Potential external side effects need an approval requirement.'));
  }
  for (const question of contract.openQuestions) findings.push(warn('open_question', question));
  const status = findings.some(item => item.level === 'fail') ? 'fail' : findings.some(item => item.level === 'warn') ? 'warn' : 'pass';
  return { status, findings };
}

export function renderMarkdown(contract, validation = validateContract(contract)) {
  const line = (items, empty = '- None listed') => items.length ? items.map(item => `- ${item}`).join('\n') : empty;
  return `# ${contract.title}\n\nStatus: ${validation.status}\n\n## Outcome\n\n${contract.outcome}\n\n## Inputs\n\n${line(contract.inputs)}\n\n## Constraints\n\n${line(contract.constraints)}\n\n## Side Effects\n\n${line(contract.sideEffects)}\n\n## Approval Requirements\n\n${line(contract.approvalsRequired)}\n\n## Verification\n\n${line(contract.verification)}\n\n## Findings\n\n${validation.findings.length ? validation.findings.map(f => `- ${f.level}: ${f.code} - ${f.message}`).join('\n') : '- pass: contract is ready for agent use'}\n`;
}

export function toJsonReport(contract) {
  return { contract, validation: validateContract(contract) };
}

function splitSections(text) {
  const sections = new Map();
  let current = 'body';
  sections.set(current, []);
  for (const raw of text.split('\n')) {
    const heading = raw.match(/^#{1,4}\s+(.+)$/);
    if (heading) {
      current = heading[1].trim().toLowerCase();
      if (!sections.has(current)) sections.set(current, []);
      continue;
    }
    sections.get(current).push(raw);
  }
  return sections;
}

function collectNamed(sections, names) {
  const out = [];
  for (const [name, lines] of sections) {
    if (names.some(key => name.includes(key))) out.push(...extractItems(lines));
  }
  return unique(out);
}

function collectBullets(sections) {
  return unique([...sections.values()].flatMap(extractItems));
}

function extractItems(lines) {
  return lines.map(line => line.trim()).filter(Boolean).map(line => line.replace(/^[-*]\s+/, '').replace(/^\d+[.)]\s+/, '')).filter(line => line.length > 2);
}

function detectSideEffects(items) {
  return unique(items.filter(item => SIDE_EFFECT_WORDS.some(word => new RegExp(`\\b${word}\\b`, 'i').test(item))));
}

function collectQuestions(text, bullets) {
  return unique([...bullets, ...text.split('\n').map(line => line.trim())].filter(line => line.includes('?')));
}

function normalizeContract(contract, source) {
  return {
    source: contract.source || source,
    title: contract.title || basename(source),
    outcome: contract.outcome || '',
    inputs: unique(contract.inputs || []),
    constraints: unique(contract.constraints || []),
    requestedActions: unique(contract.requestedActions || []),
    sideEffects: unique(contract.sideEffects || []),
    approvalsRequired: unique(contract.approvalsRequired || []),
    openQuestions: unique(contract.openQuestions || []),
    verification: unique(contract.verification || []),
    missing: unique(contract.missing || [])
  };
}

function firstHeading(text) { return text.match(/^#\s+(.+)$/m)?.[1]?.trim(); }
function firstParagraph(text) { return text.split('\n').map(line => line.trim()).find(line => line && !line.startsWith('#') && !line.startsWith('-')) || ''; }
function findFirst(sections, names) { return collectNamed(sections, names)[0] || ''; }
function unique(items) { return [...new Set(items.map(item => String(item).trim()).filter(Boolean))]; }
function basename(path) { return path.split('/').pop()?.replace(/\.[^.]+$/, '') || 'task-brief'; }
function fail(code, message) { return { level: 'fail', code, message }; }
function warn(code, message) { return { level: 'warn', code, message }; }
