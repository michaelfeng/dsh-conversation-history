const INJECTED_BLOCK_PATTERN = /<(system-reminder|available_skills|goal_round)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const INJECTED_TAG_PATTERN = /<\/?(?:system-reminder|available_skills|goal_round)\b[^>]*>/gi;

/** Escape one literal phrase for use inside a RegExp. */
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Whitespace-flexible, case-insensitive pattern for one query. */
export function compileQueryPattern(query) {
  const parts = typeof query === 'string' ? query.trim().split(/\s+/).filter(Boolean) : [];
  if (parts.length === 0) return null;
  return new RegExp(parts.map(escapeRegExp).join('\\s+'), 'i');
}

/** Strip Harness-injected prompt wrappers from text. */
function stripInjectedBlocks(text) {
  if (typeof text !== 'string' || text === '') return '';
  return text
    .replace(INJECTED_BLOCK_PATTERN, ' ')
    .replace(INJECTED_TAG_PATTERN, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Remove fenced code blocks, keeping the surrounding prose. */
function stripFencedCode(text) {
  if (typeof text !== 'string' || text === '') return '';
  const kept = [];
  let fenced = false;
  for (const line of text.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced === false) kept.push(line);
  }
  return kept.join('\n');
}

/** Text blocks of one message, ignoring tool-call/reasoning/image blocks. */
function textBlocksOf(blocks) {
  const parts = [];
  if (!Array.isArray(blocks)) return parts;
  for (const block of blocks) {
    if (block !== null && typeof block === 'object' && block.type === 'text' && typeof block.text === 'string') {
      parts.push(block.text);
    }
  }
  return parts;
}

/**
 * Natural-language prose of one durable event, or '' when it is not the
 * reader's dialogue. Injected user sources, assistant tool-call blocks, and
 * fenced code contribute nothing.
 */
export function eventProse(event) {
  if (event === null || typeof event !== 'object') return '';
  const data = event.data !== null && typeof event.data === 'object' ? event.data : null;
  if (data === null) return '';
  let blocks;
  if (event.type === 'user/message') {
    const sourceKind = data.source !== null && typeof data.source === 'object' ? data.source.kind : undefined;
    if (typeof sourceKind === 'string' && sourceKind !== 'user') return '';
    blocks = data.content;
  } else if (event.type === 'assistant/message') {
    const message = data.message !== null && typeof data.message === 'object' ? data.message : null;
    if (message === null) return '';
    blocks = message.content;
  } else {
    return '';
  }
  const joined = stripInjectedBlocks(textBlocksOf(blocks).join('\n'));
  return stripFencedCode(joined).trim();
}

/** Dialogue display row (full text) or null when the event is not dialogue. */
export function dialogueRowOf(event) {
  if (event === null || typeof event !== 'object') return null;
  const data = event.data !== null && typeof event.data === 'object' ? event.data : null;
  if (data === null) return null;
  let role = '';
  let blocks;
  if (event.type === 'user/message') {
    const sourceKind = data.source !== null && typeof data.source === 'object' ? data.source.kind : undefined;
    if (typeof sourceKind === 'string' && sourceKind !== 'user') return null;
    role = 'user';
    blocks = data.content;
  } else if (event.type === 'assistant/message') {
    const message = data.message !== null && typeof data.message === 'object' ? data.message : null;
    if (message === null) return null;
    role = 'assistant';
    blocks = message.content;
  }
  if (role === '') return null;
  const text = stripInjectedBlocks(textBlocksOf(blocks).join('\n'));
  if (text === '') return null;
  return {
    seq: typeof event.seq === 'number' ? event.seq : 0,
    time: typeof event.time === 'number' ? event.time : 0,
    role,
    text,
  };
}

/** Whether one prose excerpt is pasted code or code-trace text, not dialogue. */
function isCodeLikeText(text) {
  if (typeof text !== 'string' || text === '') return false;
  if (text.includes('\\"') || text.includes('\\n') || text.includes('```')) return true;
  if (/\(L\d{1,5}\)/.test(text)) return true;
  if (/'[a-z][a-z-]*\/[a-z][a-z-]*'/.test(text)) return true;
  let codeChars = 0;
  for (const char of text) {
    if ('{}[]=;<>\\\'"`'.includes(char)) codeChars += 1;
  }
  return text.length >= 30 && codeChars / text.length > 0.06;
}

/** Build a whitespace-collapsed snippet around the first prose match. */
export function makeSnippet(prose, pattern) {
  if (pattern === null || typeof prose !== 'string' || prose === '') return null;
  const match = pattern.exec(prose);
  if (match === null) return null;
  const start = Math.max(0, match.index - 60);
  const end = Math.min(prose.length, match.index + match[0].length + 140);
  let snippet = prose.slice(start, end).replace(/\s+/g, ' ').trim();
  if (start > 0) snippet = `…${snippet}`;
  if (end < prose.length) snippet = `${snippet}…`;
  if (isCodeLikeText(snippet)) return null;
  return snippet;
}

