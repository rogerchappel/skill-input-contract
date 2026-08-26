import fs from 'node:fs';

const EXTERNAL_SIDE_EFFECT_PATTERNS = [
  /\b(?:send|sends|sending|sent)\b/gi,
  /\b(?:post|posts|posted|posting)\b/gi,
  /\b(?:publish|publishes|published|publishing)\b/gi,
  /\b(?:delete|deletes|deleted|deleting)\b/gi,
  /\b(?:push|pushes|pushed|pushing)\b/gi,
  /\b(?:merge|merges|merged|merging)\b/gi,
  /\b(?:email|emails|emailed|emailing)\b/gi,
  /\b(?:notify|notifies|notified|notifying)\b/gi,
  /\b(?:upload|uploads|uploaded|uploading)\b/gi
];
const NEGATION_PATTERN = /\b(?:not|never|without|cannot|can't|do not|don't|does not|doesn't|did not|didn't)\b/i;
const ACTION_CLAUSE_SPLIT_PATTERN = /^\s*without\b[^,]*,\s*|\b(?:but|however|yet)\b|,\s*(?=(?:then|subsequently)\b)|[.;]/i;
const WRITE_CLAUSE_SPLIT_PATTERN = /^\s*without\b[^,]*,\s*|\b(?:and|then|but|however|yet)\b|,|[.;]/i;
const DURABLE_WRITE_PATTERN = /\b(?:write|writes|writing|wrote|written)\b/gi;
const LOCAL_ONLY_WRITE_PATTERNS = [
  /\blocally\b/i,
  /\blocal (?:file|report|output|artifact)s?\b/i,
  /\b(?:stdout|standard output)\b/i
];
const APPROVAL_TERM = String.raw`(?:approval|confirmation|permission|authoriz(?:e|ation)|consent)`;
const APPROVAL_PATTERN = new RegExp(`\\b${APPROVAL_TERM}\\b`, 'i');
const DENIED_APPROVAL_PATTERNS = [
  new RegExp(`\\bno(?:\\s+\\w+){0,3}\\s+${APPROVAL_TERM}\\b`, 'i'),
  new RegExp(`\\b${APPROVAL_TERM}\\b(?:\\s+\\w+){0,3}\\s+(?:not|never)\\s+(?:required|needed|necessary)\\b`, 'i'),
  new RegExp(`\\bwithout\\s+(?:any\\s+)?${APPROVAL_TERM}\\b`, 'i')
];
const NEGATED_WITHOUT_APPROVAL_PATTERN = new RegExp(
  `\\b(?:do not|don't|never)\\b[^.;]*\\bwithout\\s+(?:any\\s+)?${APPROVAL_TERM}\\b`,
  'i'
);
const SIDE_EFFECT_TERM = String.raw`(?:send(?:s|ing|sent)?|post(?:s|ed|ing)?|publish(?:es|ed|ing)?|delete(?:s|d|ing)?|push(?:es|ed|ing)?|merge(?:s|d|ing)?|email(?:s|ed|ing)?|notif(?:y|ies|ied|ying)|upload(?:s|ed|ing)?|write(?:s|ing)?|wrote|written)`;
const POST_ACTION_APPROVAL_PATTERNS = [
  new RegExp(`\\b${APPROVAL_TERM}\\b[^.;]*\\b(?:after|once|following)\\b[^.;]*\\b${SIDE_EFFECT_TERM}\\b`, 'i'),
  new RegExp(`\\b${SIDE_EFFECT_TERM}\\b[^.;]*\\bbefore\\b[^.;]*\\b${APPROVAL_TERM}\\b`, 'i')
];
const APPROVAL_SCOPE_FAMILIES = [
  /\b(?:send|sends|sending|sent)\b/i,
  /\b(?:post|posts|posted|posting)\b/i,
  /\b(?:publish|publishes|published|publishing)\b/i,
  /\b(?:delete|deletes|deleted|deleting)\b/i,
  /\b(?:push|pushes|pushed|pushing)\b/i,
  /\b(?:merge|merges|merged|merging)\b/i,
  /\b(?:email|emails|emailed|emailing)\b/i,
  /\b(?:notify|notifies|notified|notifying)\b/i,
  /\b(?:upload|uploads|uploaded|uploading)\b/i,
  /\b(?:write|writes|writing|wrote|written)\b/i
];
const BROAD_APPROVAL_SCOPE_PATTERNS = [
  /\b(?:any|all|every)\s+(?:external\s+)?(?:action|change|side effect)s?\b/i,
  /\blocal[- ]only\b[^.;]*\b(?:until|unless|before)\b/i,
  new RegExp(`\\b(?:do not|don't|never)\\b[^.;]*\\buntil\\b[^.;]*\\b${APPROVAL_TERM}\\b`, 'i')
];

export function parseTaskBrief(text, source = 'inline') {
  const input = String(text || '');
  if (!input.trim()) throw new Error('Task brief is empty');
  if (source.endsWith('.json')) {
    const contract = JSON.parse(input);
    validateJsonContract(contract);
    return normalizeContract(contract, source);
  }
  const normalized = stripFencedCodeBlocks(input.replace(/\r\n?|\n/g, '\n'));

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
  const approvals = constraints.filter(isApprovalRequirement);

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
  for (const sideEffect of uncoveredSideEffects(contract)) {
    findings.push(fail('approval_gap', `Potential external side effect needs a matching approval requirement: ${sideEffect}`));
  }
  for (const question of contract.openQuestions) findings.push(warn('open_question', question));
  const status = findings.some(item => item.level === 'fail') ? 'fail' : findings.some(item => item.level === 'warn') ? 'warn' : 'pass';
  return { status, findings };
}

function uncoveredSideEffects(contract) {
  if (contract.sideEffects.length === 0) return [];
  if (contract.approvalsRequired.some(requirement => BROAD_APPROVAL_SCOPE_PATTERNS.some(pattern => pattern.test(requirement)))) return [];

  return contract.sideEffects.filter(sideEffect => {
    const families = APPROVAL_SCOPE_FAMILIES.filter(pattern => pattern.test(sideEffect));
    return families.length === 0 || !contract.approvalsRequired.some(requirement => families.some(pattern => pattern.test(requirement)));
  });
}

export function scoreContract(contract) {
  const validation = validateContract(contract);
  const base = validation.status === 'pass' ? 100 : validation.status === 'warn' ? 75 : 45;
  const coverage = [
    contract.inputs.length > 0,
    contract.constraints.length > 0,
    contract.requestedActions.length > 0,
    contract.verification.length > 0
  ].filter(Boolean).length * 5;
  return Math.min(100, base + coverage);
}

export function renderMarkdown(contract, validation = validateContract(contract)) {
  const line = (items, empty = '- None listed') => items.length ? items.map(item => `- ${item}`).join('\n') : empty;
  return `# ${contract.title}\n\nStatus: ${validation.status}\n\n## Outcome\n\n${contract.outcome}\n\n## Inputs\n\n${line(contract.inputs)}\n\n## Constraints\n\n${line(contract.constraints)}\n\n## Side Effects\n\n${line(contract.sideEffects)}\n\n## Approval Requirements\n\n${line(contract.approvalsRequired)}\n\n## Verification\n\n${line(contract.verification)}\n\n## Findings\n\n${validation.findings.length ? validation.findings.map(f => `- ${f.level}: ${f.code} - ${f.message}`).join('\n') : '- pass: contract is ready for agent use'}\n`;
}

export function toJsonReport(contract) {
  return { contract, validation: validateContract(contract), score: scoreContract(contract) };
}

function splitSections(text) {
  const sections = new Map();
  let current = 'body';
  sections.set(current, []);
  for (const raw of text.split('\n')) {
    const heading = raw.match(/^#{1,4}\s+(.+)$/);
    if (heading) {
      current = heading[1].replace(/\s+#+\s*$/, '').trim().toLowerCase();
      if (!sections.has(current)) sections.set(current, []);
      continue;
    }
    sections.get(current).push(raw);
  }
  return sections;
}

function stripFencedCodeBlocks(text) {
  let fence = null;
  return text.split('\n').map(line => {
    if (fence) {
      const closing = line.match(/^ {0,3}(`{3,}|~{3,})[ \t]*$/);
      if (closing && closing[1][0] === fence.character && closing[1].length >= fence.length) fence = null;
      return '';
    }

    const opening = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (!opening) return line;
    if (opening[1][0] === '`' && opening[2].includes('`')) return line;
    fence = { character: opening[1][0], length: opening[1].length };
    return '';
  }).join('\n');
}

function collectNamed(sections, names) {
  const out = [];
  for (const [name, lines] of sections) {
    if (names.includes(name)) out.push(...extractItems(lines));
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
  return unique(items.filter(item => {
    const hasExternalAction = item
      .split(ACTION_CLAUSE_SPLIT_PATTERN)
      .some(clause => EXTERNAL_SIDE_EFFECT_PATTERNS.some(pattern => hasAffirmativeMatch(clause, pattern)));
    if (hasExternalAction) return true;

    return item
      .split(WRITE_CLAUSE_SPLIT_PATTERN)
      .some(clause => hasAffirmativeMatch(clause, DURABLE_WRITE_PATTERN)
        && !LOCAL_ONLY_WRITE_PATTERNS.some(pattern => pattern.test(clause)));
  }));
}

function hasAffirmativeMatch(clause, pattern) {
  pattern.lastIndex = 0;
  for (const match of clause.matchAll(pattern)) {
    const prefix = clause.slice(0, match.index);
    if (!NEGATION_PATTERN.test(prefix) && !isApprovalGuard(prefix)) return true;
  }
  return false;
}

function isApprovalGuard(prefix) {
  const approval = prefix.match(APPROVAL_PATTERN);
  if (!approval) return false;
  return /\bbefore\b/i.test(prefix.slice(approval.index + approval[0].length));
}

function hasWord(item, word) {
  return new RegExp(`\\b${word}\\b`, 'i').test(item);
}

function isApprovalRequirement(item) {
  if (!APPROVAL_PATTERN.test(item)) return false;
  if (NEGATED_WITHOUT_APPROVAL_PATTERN.test(item)) return true;
  if (POST_ACTION_APPROVAL_PATTERNS.some(pattern => pattern.test(item))) return false;
  return !DENIED_APPROVAL_PATTERNS.some(pattern => pattern.test(item));
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

const JSON_SCALAR_FIELDS = ['source', 'title', 'outcome'];
const JSON_COLLECTION_FIELDS = [
  'inputs', 'constraints', 'requestedActions', 'sideEffects',
  'approvalsRequired', 'openQuestions', 'verification', 'missing'
];

function validateJsonContract(contract) {
  if (contract === null || typeof contract !== 'object' || Array.isArray(contract)) {
    throw new Error('Invalid JSON contract: expected an object');
  }
  for (const field of JSON_SCALAR_FIELDS) {
    if (field in contract && typeof contract[field] !== 'string') {
      throw new Error(`Invalid JSON contract field "${field}": expected a string`);
    }
  }
  for (const field of JSON_COLLECTION_FIELDS) {
    if (!(field in contract)) continue;
    if (!Array.isArray(contract[field])) {
      throw new Error(`Invalid JSON contract field "${field}": expected an array of strings`);
    }
    const invalidIndex = contract[field].findIndex(item => typeof item !== 'string');
    if (invalidIndex !== -1) {
      throw new Error(`Invalid JSON contract field "${field}[${invalidIndex}]": expected a string`);
    }
  }
}

function firstHeading(text) { return text.match(/^#\s+(.+)$/m)?.[1]?.trim(); }
function firstParagraph(text) { return text.split('\n').map(line => line.trim()).find(line => line && !line.startsWith('#') && !line.startsWith('-')) || ''; }
function findFirst(sections, names) { return collectNamed(sections, names)[0] || ''; }
function unique(items) { return [...new Set(items.map(item => String(item).trim()).filter(Boolean))]; }
function basename(path) { return path.split('/').pop()?.replace(/\.[^.]+$/, '') || 'task-brief'; }
function fail(code, message) { return { level: 'fail', code, message }; }
function warn(code, message) { return { level: 'warn', code, message }; }
