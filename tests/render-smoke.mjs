/**
 * Render-smoke harness for client.js.
 *
 * It loads the real Client module behind a fake `window.__ModuleLoader__` and a
 * minimal React hook surface, then renders the registered Conversation View with
 * representative props for every state branch. It also parses both inline
 * dictionaries and asserts their key sets are identical.
 */
import { readFileSync } from 'node:fs';
import { apply as applyHostPlugin } from '../index.js';

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8');

// ---- dictionaries: parse and compare -----------------------------------------
function dictionaryKeys(name) {
  const start = source.indexOf(`const ${name} = {`);
  const end = source.indexOf('\n    };', start);
  const body = source.slice(start, end);
  return [...body.matchAll(/^\s{6}(?:'([^']+)'|([A-Za-z][\w]*)):/gm)].map((m) => m[1] ?? m[2]);
}
const enKeys = dictionaryKeys('en');
const zhKeys = dictionaryKeys('zh');
if (enKeys.length !== zhKeys.length || enKeys.some((key, index) => key !== zhKeys[index])) {
  throw new Error(`dictionary mismatch:\nen=${enKeys.join(',')}\nzh=${zhKeys.join(',')}`);
}
const dictionary = new Set(enKeys);

// ---- fake React --------------------------------------------------------------
let hookOverrides = {};
let hookIndex = 0;
const fakeReact = {
  createElement: (type, props, ...children) => ({ type, props: { ...(props ?? {}), children: children.filter((child) => child !== null && child !== undefined) } }),
  useState: (initial) => {
    const index = hookIndex++;
    const base = typeof initial === 'function' ? initial() : initial;
    const override = Object.hasOwn(hookOverrides, index) ? hookOverrides[index] : base;
    return [override, () => {}];
  },
  useMemo: (factory) => factory(),
  useEffect: () => {},
  useRef: (initial) => ({ current: initial }),
};

// ---- fake loader -------------------------------------------------------------
let captured;
globalThis.window = {
  __ModuleLoader__: {
    load(definition) {
      captured = definition;
    },
  },
};
const styleTags = [];
globalThis.document = {
  head: {
    appendChild(tag) {
      styleTags.push(tag);
    },
  },
  createElement() {
    return { dataset: {}, textContent: '', remove() { const index = styleTags.indexOf(this); if (index >= 0) styleTags.splice(index, 1); } };
  },
};

const require = (specifier) => {
  if (specifier === 'react') return fakeReact;
  throw new Error(`unexpected require: ${specifier}`);
};

// Evaluate the classic-script Client module so it registers itself with the fake loader.
new Function(source)();
if (captured === undefined) throw new Error('client module did not call window.__ModuleLoader__.load');

const exportsObject = captured.factory(require);
if (captured.id !== 'dsh-conversation-history') throw new Error(`bad module id ${captured.id}`);

// ---- fake host context -------------------------------------------------------
const translated = [];
const t = (key, params) => {
  translated.push(key);
  if (!dictionary.has(key)) throw new Error(`missing dictionary key: ${key}`);
  return params === undefined ? key : `${key}(${JSON.stringify(params)})`;
};
const syntheticCodeSnippet = String.raw`...items[\"sample_count\"] = [\"SEARCH\", \"placeholder\"];\n render(items);`;
const syntheticSkillFragment = String.raw`...available_skills> - example-helper: fictional tool guidance.`;
const syntheticTraceFragment = String.raw`...renderPreview (L120) reads 'demo/input' and writes 'demo/output'; trace only.`;
const contextTime = Date.now();
const syntheticEntries = [
  { type: 'event', event: { type: 'user/message', seq: 1, time: contextTime, data: { source: { kind: 'user' }, content: [{ type: 'text', text: '请检查 SEARCH 数据' }] } } },
  { type: 'event', event: { type: 'user/message', seq: 2, time: contextTime, data: { source: { kind: 'goal', round: 3 }, content: [{ type: 'text', text: '<goal_round>Objective: 继续研究</goal_round>' }] } } },
  { type: 'event', event: { type: 'user/message', seq: 3, time: contextTime, data: { source: { kind: 'runtime-context', form: 'snapshot' }, content: [{ type: 'text', text: 'Current working directory: /tmp' }] } } },
  { type: 'event', event: { type: 'assistant/message', seq: 4, time: contextTime, data: { message: { content: [{ type: 'text', text: 'SEARCH 结论如下' }] } } } },
  { type: 'event', event: { type: 'tool/call', seq: 5, time: contextTime, data: { name: 'bash', arguments: '{"command":"grep SEARCH"}' } } },
  { type: 'event', event: { type: 'tool/result', seq: 6, time: contextTime, data: { message: { content: [{ type: 'text', text: 'SEARCH 1041 hits' }] } } } },
];
let loadOlderCalls = 0;

let hostConnection;
const opened = [];
const registrations = [];
const fakeCtx = {
  effect: (callback) => callback(),
  get: (name) => (name === 'connection' ? hostConnection : undefined),
  locale: { register: () => () => {}, bind: () => t },
  sessions: {
    search: async () => ({ ok: true, value: { items: [], hasMore: false } }),
    retain: () => ({
      ready: Promise.resolve(),
      release: () => {},
      binding: {
        eventSource: { getSnapshot: () => ({ entries: syntheticEntries, hasMore: false }) },
        session: { loadOlder: async () => { loadOlderCalls += 1; } },
      },
    }),
  },
  uiWorkspace: { openSession: (id) => opened.push(id) },
  slots: {
    inject: (name, callback) => {
      callback();
      return () => {};
    },
    register: (options, component) => {
      registrations.push({ options, component });
      return () => {};
    },
  },
};
exportsObject.apply(fakeCtx);
const registration = registrations.find((entry) => entry.options.id === 'history');
if (registration === undefined) throw new Error('history view was not registered');
if (registration.options.name !== 'conversation.view') throw new Error('registered into the wrong slot');
if (registration.options.order !== 20) throw new Error('unexpected order');
if (typeof registration.options.label !== 'function' || registration.options.label() !== 'view.history') {
  throw new Error('view label thunk is not localized');
}
const injected = registration.options.inject();
if (typeof injected.searchHistory !== 'function' || typeof injected.openConversation !== 'function') {
  throw new Error('injected operations missing');
}
if (typeof injected.loadSessionContext !== 'function') {
  throw new Error('injected context loader missing');
}

// ---- render helpers ----------------------------------------------------------
function render(props) {
  hookIndex = 0;
  const element = registration.component(props);
  return { element, text: collectText(element).join('') };
}
function collectText(node) {
  if (typeof node === 'string' || typeof node === 'number') return [String(node)];
  if (node === null || node === undefined || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(collectText);
  return [].concat(...(node.props?.children ?? []).map(collectText));
}
function findAll(node, predicate, out = []) {
  if (node === null || node === undefined || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    for (const item of node) findAll(item, predicate, out);
    return out;
  }
  if (predicate(node)) out.push(node);
  for (const child of node.props?.children ?? []) findAll(child, predicate, out);
  return out;
}
const byId = {
  'session-a': { id: 'session-a', displayTitle: 'Planning the sample launch', updatedAt: Date.now(), blank: false },
  'session-b': { id: 'session-b', displayTitle: 'Documentation migration notes', updatedAt: Date.now() - 7200000, blank: false },
  'session-c': { id: 'session-c', displayTitle: 'Blank new chat', updatedAt: Date.now(), blank: true },
  'session-d': { id: 'session-d', displayTitle: 'Subagent work', updatedAt: Date.now(), origin: 'subagent' },
};
const props = {
  sessionId: 'session-a',
  useSessions: (selector) => selector({ ids: Object.keys(byId), byId }),
  t,
  searchHistory: injected.searchHistory,
  openConversation: injected.openConversation,
  loadSessionContext: injected.loadSessionContext,
};

// idle: recent list
{
  hookOverrides = {};
  const { element, text } = render(props);
  if (!text.includes('recent.title')) throw new Error('recent heading missing');
  if (!text.includes('Planning the sample launch') || !text.includes('Documentation migration notes')) throw new Error('recent titles missing');
  if (text.includes('Blank new chat') || text.includes('Subagent work')) throw new Error('blank/subagent rows must be excluded');
  if (!text.includes('current.badge')) throw new Error('current-conversation badge missing');
  const searchInput = findAll(element, (node) => node.type === 'input')[0];
  if (searchInput === undefined) throw new Error('search input missing');
  if (searchInput.props.type !== 'search' || searchInput.props['aria-label'] !== 'search.label') throw new Error('search input not accessible');
  if (searchInput.props.value !== '') throw new Error('initial query must be empty');
  if (typeof searchInput.props.onChange !== 'function' || typeof searchInput.props.onKeyDown !== 'function') throw new Error('search input handlers missing');
  const region = element;
  if (region.props.role !== 'region' || region.props['aria-label'] !== 'title') throw new Error('root landmark missing');
  if (!Object.hasOwn(region.props, 'data-conversation-composer-overlay')) throw new Error('composer overlay marker missing');
}

// idle Enter selects the first recent conversation in place (no navigation)
{
  opened.length = 0;
  const { element } = render(props);
  const input = findAll(element, (node) => node.type === 'input')[0];
  let prevented = false;
  input.props.onKeyDown({ key: 'Enter', preventDefault: () => { prevented = true; } });
  if (!prevented) throw new Error('Enter was not handled');
  if (opened.length !== 0) throw new Error('Enter must not navigate to the session');
}

// idle ArrowDown and Escape must not throw
{
  const { element } = render(props);
  const input = findAll(element, (node) => node.type === 'input')[0];
  input.props.onKeyDown({ key: 'ArrowDown', preventDefault: () => {} });
  input.props.onKeyDown({ key: 'ArrowUp', preventDefault: () => {} });
  input.props.onKeyDown({ key: 'Escape', preventDefault: () => {} });
  input.props.onKeyDown({ key: 'Enter', preventDefault: () => {} });
}

// loading (first search, no previous results)
{
  hookOverrides = { 0: 'abc', 1: null, 2: 'searching', 3: '' };
  const { element, text } = render(props);
  if (!text.includes('search.searching')) throw new Error('loading copy missing');
  const spinner = findAll(element, (node) => node.props?.className === 'dsh-ch-spinner');
  if (spinner.length === 0) throw new Error('spinner missing');
  if (findAll(element, (node) => node.props?.className === 'dsh-ch-dot').length !== 1) throw new Error('busy dot missing');
}

// ready with grouped hits, instant title matches, timing, and highlighting
{
  hookOverrides = {
    0: 'launch',
    1: {
      query: 'launch',
      hasMore: true,
      tookMs: 120,
      items: [
        { sessionId: 'session-a', snippet: 'launch engine regression passed' },
        { sessionId: 'session-a', snippet: 'second launch note' },
        { sessionId: 'session-b', snippet: 'unrelated? launch appears here too' },
      ],
    },
    2: 'idle',
    3: '',
  };
  const { element, text } = render(props);
  if (!text.includes('search.results({"count":3})')) throw new Error(`result count missing: ${text.slice(0, 200)}`);
  if (!text.includes('search.took({"ms":120})')) throw new Error('timing readout missing');
  if (!text.includes('search.more')) throw new Error('hasMore note missing');
  if (!text.includes('search.titleMatches')) throw new Error('instant title matches missing');
  if (!text.includes('search.messageMatches')) throw new Error('message-match section heading missing');
  if (!text.includes('search.sessionKind')) throw new Error('session kind chip missing');
  const marks = findAll(element, (node) => node.type === 'mark');
  if (marks.length !== 5) throw new Error(`expected 3 snippet highlights plus 2 highlighted titles, got ${marks.length}`);
  if (marks[0].props.children[0] !== 'launch') throw new Error('highlight text mismatch');
  const sections = findAll(element, (node) => node.type === 'section');
  if (sections.length !== 4) throw new Error(`expected title section, message section, and 2 group cards, got ${sections.length}`);
  const groupCards = sections.filter((node) => node.props.className === 'dsh-ch-group');
  if (groupCards.length !== 2) throw new Error(`expected 2 session cards, got ${groupCards.length}`);
  // a hit selects its session in the context pane instead of navigating away
  opened.length = 0;
  const hitButtons = findAll(element, (node) => node.props?.className === 'dsh-ch-hit');
  if (hitButtons.length !== 3) throw new Error(`expected 3 hit rows, got ${hitButtons.length}`);
  hitButtons[2].props.onClick();
  if (opened.length !== 0) throw new Error('a hit must not navigate to the session');
  // Enter selects the first instant title match in place
  const input = findAll(element, (node) => node.type === 'input')[0];
  input.props.onKeyDown({ key: 'Enter', preventDefault: () => {} });
  if (opened.length !== 0) throw new Error('Enter must not navigate to the session');
}

// stale-while-revalidate: previous results stay visible while a new query runs
{
  hookOverrides = {
    0: 'launch engine',
    1: { query: 'launch', items: [{ sessionId: 'session-a', snippet: 'launch engine regression passed' }], hasMore: false, tookMs: 80 },
    2: 'searching',
    3: '',
  };
  const { element, text } = render(props);
  if (!text.includes('search.updating')) throw new Error('stale-while-revalidate must say it is updating, not searching');
  if (text.includes('search.searching')) throw new Error('a prior result set must not be replaced by the blocking searching copy');
  if (findAll(element, (node) => node.type === 'mark').length < 1) throw new Error('previous results must stay visible while searching');
  if (findAll(element, (node) => node.props?.className === 'dsh-ch-spinner').length !== 0) throw new Error('no blocking spinner when previous results exist');
}

// ready with no matches
{
  hookOverrides = { 0: 'zzz', 1: { query: 'zzz', items: [], hasMore: false, tookMs: 50 }, 2: 'idle', 3: '' };
  const { element, text } = render(props);
  if (!text.includes('search.emptyFor')) throw new Error('no-match copy missing');
  if (findAll(element, (node) => node.props?.['aria-label'] === 'search.prevMatch').length !== 0) throw new Error('no open pane means no match arrows');
}

// a single-character query is never sent to the Host
{
  hookOverrides = { 0: 'a', 1: null, 2: 'idle', 3: '' };
  const { text } = render(props);
  if (!text.includes('search.minLength')) throw new Error('minimum-length hint missing');
  if (text.includes('search.searching')) throw new Error('single-character query must not search');
}

// failure
{
  hookOverrides = { 0: 'xx', 1: null, 2: 'error', 3: 'transport down' };
  const { element, text } = render(props);
  if (!text.includes('search.failed')) throw new Error('failure copy missing');
  if (findAll(element, (node) => node.props?.role === 'alert').length !== 1) throw new Error('failure must be an alert');
}

// context pane: loading state for the selected hit
{
  hookOverrides = {
    0: 'launch',
    1: null,
    2: 'idle',
    3: '',
    5: { sessionId: 'session-a', query: 'launch' },
    6: { kind: 'loading' },
    7: 0,
  };
  const { element, text } = render(props);
  const pane = findAll(element, (node) => node.props?.['aria-label'] === 'context.title');
  if (pane.length !== 1) throw new Error('context pane missing');
  if (!text.includes('context.loading')) throw new Error('context loading copy missing');
  if (!text.includes('Planning the sample launch')) throw new Error('context header title missing');
}

// context pane: ready rows, keyword highlight, explicit open action
{
  hookOverrides = {
    0: 'launch',
    1: null,
    2: 'idle',
    3: '',
    5: { sessionId: 'session-a', query: 'launch' },
    6: {
      kind: 'ready',
      found: true,
      hasMore: false,
      rows: [
        { seq: 1, time: Date.now() - 5000, role: 'user', text: 'first launch note' },
        { seq: 2, time: Date.now(), role: 'assistant', text: 'second message without the term' },
      ],
    },
    7: 0,
  };
  const { element, text } = render(props);
  const paneElement = findAll(element, (node) => node.props?.['aria-label'] === 'context.title')[0];
  const marks = findAll(paneElement, (node) => node.type === 'mark');
  if (marks.length !== 1) throw new Error(`expected one highlighted match in context, got ${marks.length}`);
  if (marks[0].props.children[0] !== 'launch') throw new Error('context highlight text mismatch');
  if (!text.includes('context.role.user') || !text.includes('context.role.assistant')) throw new Error('context role labels missing');
  if (findAll(element, (node) => node.props?.['data-context-hit'] === 'true').length !== 1) throw new Error('matched context row marker missing');
  opened.length = 0;
  const openButton = findAll(element, (node) => node.props?.className === 'dsh-ch-detailAction' && node.props?.children?.[0] === 'context.open')[0];
  if (openButton === undefined) throw new Error('explicit open action missing');
  openButton.props.onClick();
  if (opened[0] !== 'session-a') throw new Error(`explicit open used ${opened[0]}`);
}

// context pane: passage not located, more context available
{
  hookOverrides = {
    0: 'launch',
    1: null,
    2: 'idle',
    3: '',
    5: { sessionId: 'session-a', query: 'launch' },
    6: {
      kind: 'ready',
      found: false,
      hasMore: true,
      rows: Array.from({ length: 200 }, (_, index) => ({ seq: index + 1, role: index % 2 === 0 ? 'user' : 'assistant', text: `unrelated row ${index}` })),
    },
    7: 0,
  };
  const { text } = render(props);
  if (!text.includes('context.notFound')) throw new Error('not-located hint missing');
  if (!text.includes('context.loadMore')) throw new Error('expand-context action missing');
}

// context pane: Markdown blocks (table, heading, bold, list, fenced code) render formatted
{
  hookOverrides = {
    0: '',
    1: null,
    2: 'idle',
    3: '',
    5: { sessionId: 'session-a', query: 'launch' },
    6: {
      kind: 'ready',
      found: true,
      hasMore: false,
      rows: [
        {
          seq: 1,
          role: 'assistant',
          text: '## 任务进度\n\n| 任务 | 状态 |\n|---|---|\n| 示例文档 | **完成** |\n\n- one\n- two\n\n```js\nconst x = 1;\n```\n',
        },
        { seq: 2, role: 'assistant', text: '长消息 '.repeat(3000) },
      ],
    },
    7: 0,
  };
  const { element, text } = render(props);
  if (findAll(element, (node) => node.type === 'table').length !== 1) throw new Error('markdown table not rendered');
  if (findAll(element, (node) => node.type === 'thead').length !== 1) throw new Error('table head missing');
  if (findAll(element, (node) => node.props?.className === 'dsh-ch-mdList').length !== 1) throw new Error('markdown list not rendered');
  if (findAll(element, (node) => node.type === 'strong').length !== 1) throw new Error('bold run not rendered');
  if (findAll(element, (node) => node.props?.className === 'dsh-ch-mdPre').length !== 1) throw new Error('fenced code block not rendered');
  if (findAll(element, (node) => typeof node.props?.className === 'string' && node.props.className.split(' ').includes('dsh-ch-mdHeading')).length !== 1) throw new Error('heading not rendered');
  if (!text.includes('context.expand')) throw new Error('expand control missing for a long message');
  if (!text.includes('完成')) throw new Error('table cell text missing');
  if (text.includes('context.role.tool')) throw new Error('tool rows must not render');
}

// A bold/code token before a match must not consume the highlight occurrence id.
{
  hookOverrides = {0: 'needle', 1: null, 2: 'idle', 5: {sessionId:'session-a',query:'needle'},
    6:{kind:'ready',found:true,anchorSeq:2,rows:[{seq:2,role:'assistant',text:'**Introduction** then `code` and needle'}]}};
  const {element} = render(props);
  const marks = findAll(element, n => n.type === 'mark' && n.props['data-current-match'] === 'true');
  if (marks.length !== 1) throw new Error('Markdown tokens consumed the active highlight index');
}

// context pane: a tool-message match anchors the dialogue window without rendering tools
{
  hookOverrides = {
    0: 'search',
    1: null,
    2: 'idle',
    3: '',
    5: { sessionId: 'session-a', query: 'search' },
    6: {
      kind: 'ready',
      found: true,
      anchorSeq: 30,
      hasMore: false,
      rows: [
        { seq: 10, role: 'user', text: 'first question' },
        { seq: 20, role: 'assistant', text: 'first answer' },
        { seq: 40, role: 'user', text: 'second question' },
        { seq: 50, role: 'assistant', text: 'second answer' },
      ],
    },
    7: 0,
  };
  const { element, text } = render(props);
  if (text.includes('context.offDialogue') || text.includes('context.anchorMarker')) throw new Error('non-dialogue marker copy must not render');
  const marked = findAll(element, (node) => node.props?.['data-context-hit'] === 'true');
  if (marked.length !== 1) throw new Error('anchored row marker missing');
}

// context loader: dialogue rows only, injected user messages and tools excluded
{
  const humanQuery = await injected.loadSessionContext('session-a', 'SEARCH', 3);
  if (humanQuery.rows.length !== 2) throw new Error(`expected 2 dialogue rows, got ${humanQuery.rows.length}: ${JSON.stringify(humanQuery.rows)}`);
  if (!humanQuery.rows.every((row) => row.role === 'user' || row.role === 'assistant')) throw new Error('non-dialogue row leaked from the loader');
  const joined = humanQuery.rows.map((row) => row.text).join('\n');
  if (joined.includes('goal_round') || joined.includes('Current working directory')) throw new Error('injected context leaked into the context pane');
  if (humanQuery.found !== true || humanQuery.anchorSeq !== 1) throw new Error(`dialogue match not anchored: ${JSON.stringify(humanQuery)}`);

  const toolQuery = await injected.loadSessionContext('session-a', '1041', 3);
  if (toolQuery.rows.length !== 2) throw new Error('tool hit must still return only dialogue rows');
  if (toolQuery.found !== true || toolQuery.anchorSeq !== 6) throw new Error(`tool hit not anchored to its event: ${JSON.stringify(toolQuery)}`);

  const injectedQuery = await injected.loadSessionContext('session-a', 'Objective', 3);
  if (injectedQuery.anchorSeq !== 2) throw new Error('injected-context hit should anchor on its own event');

  const missingQuery = await injected.loadSessionContext('session-a', 'zzzz', 3);
  if (missingQuery.found !== false || missingQuery.anchorSeq !== 0) throw new Error('missing phrase must report not found');

  const snippetProbe = await injected.loadSessionContext('session-a', 'zzzz', 3, 'SEARCH 1041 hits');
  if (snippetProbe.found !== true || snippetProbe.anchorSeq !== 6) throw new Error('snippet probe must locate the matched event');

  if (loadOlderCalls !== 0) throw new Error('no extra pages should load when the tail already answers');
}

// search history: prefers the dialogue-only Host endpoint, falls back to the shipped search
{
  hostConnection = {
    rpc: {
      call: async (channel, endpoint, payload) => {
        if (channel !== '/api' || endpoint !== 'conversation-history/search') throw new Error('unexpected host RPC target');
        return { ok: true, value: { items: [{ sessionId: 'dialogue-session', snippet: 'assistant SEARCH answer' }], hasMore: false, proseFiltered: payload.query === 'SEARCH' } };
      },
    },
  };
  const hosted = await injected.searchHistory('SEARCH', undefined);
  if (hosted.ok !== true || hosted.value.items.length !== 1) throw new Error('host dialogue search result not used');
  if (hosted.value.items[0].sessionId !== 'dialogue-session') throw new Error('host dialogue search item mismatch');
  if (hosted.hosted !== true) throw new Error('a prose-verified Host search must be trusted');
  const legacy = await injected.searchHistory('Search', undefined);
  if (legacy.hosted !== false) throw new Error('an old Host without proseFiltered must not be trusted as verified');
  hostConnection = undefined;
  const fallback = await injected.searchHistory('SEARCH', undefined);
  if (fallback.ok !== true) throw new Error('host-required result must still resolve');
  if (fallback.hostUnavailable !== true) throw new Error('missing Host must be reported');
  if (fallback.value.items.length !== 0) throw new Error('unfiltered fallback items must not be returned');
}

// context loader: a session-kind selection skips Host locate and returns recent rows
{
  let locateCalls = 0;
  hostConnection = {
    rpc: {
      call: async () => {
        locateCalls += 1;
        throw new Error('session-kind selection must not call locate');
      },
    },
  };
  const recent = await injected.loadSessionContext('session-a', 'release plan', 8, '', { kind: 'session', seq: 0 });
  hostConnection = undefined;
  if (locateCalls !== 0) throw new Error('session-kind selection must not call the Host locate route');
  if (recent.found !== false) throw new Error('recent context is not a keyword match');
  if (recent.rows.length === 0) throw new Error('recent context rows missing');
}

// context loader: a message hit forwards its exact event sequence to the Host
{
  let seenSeq = 0;
  hostConnection = {
    rpc: {
      call: async (channel, endpoint, payload) => {
        if (endpoint !== 'conversation-history/locate') throw new Error('unexpected endpoint');
        seenSeq = payload.seq;
        return { ok: true, value: { found: true, anchorSeq: 42, rows: [{ seq: 42, time: 1, role: 'assistant', text: 'release plan answer' }], total: 1, matches: 1 } };
      },
    },
  };
  const hitContext = await injected.loadSessionContext('session-a', 'release plan', 8, 'release plan answer', { kind: 'message', seq: 42 });
  hostConnection = undefined;
  if (seenSeq !== 42) throw new Error(`clicked event sequence not forwarded (got ${seenSeq})`);
  if (hitContext.found !== true) throw new Error('host anchor result missing');
}

// context loader: a Host "not found" is final (no page-walk fallback)
{
  hostConnection = {
    rpc: {
      call: async (channel, endpoint) => {
        if (channel !== '/api' || endpoint !== 'conversation-history/locate') throw new Error('unexpected host RPC target');
        return { ok: true, value: { found: false, rows: [], anchorSeq: 0, total: 0, matches: 0 } };
      },
    },
  };
  const authoritative = await injected.loadSessionContext('session-a', 'SEARCH', 8, '');
  hostConnection = undefined;
  if (authoritative.found !== false) throw new Error('host not-found must stay authoritative');
  if (authoritative.rows.length !== 0) throw new Error('page-walk rows must not replace a Host not-found');
}

// context loader: prefers the Host locate RPC when the Host half is loaded
{
  hostConnection = {
    rpc: {
      call: async (channel, endpoint) => {
        if (channel !== '/api' || endpoint !== 'conversation-history/locate') throw new Error('unexpected host RPC target');
        return {
          ok: true,
          value: {
            found: true,
            anchorSeq: 6,
            rows: [
              { seq: 5, time: 1, role: 'user', text: 'host launch question' },
              { seq: 6, time: 2, role: 'assistant', text: 'host launch answer' },
            ],
          },
        };
      },
    },
  };
  const viaHost = await injected.loadSessionContext('session-a', 'launch', 8, 'host launch question');
  hostConnection = undefined;
  if (viaHost.found !== true || viaHost.anchorSeq !== 6) throw new Error('host locate result not used');
  if (viaHost.rows.length !== 2 || viaHost.rows[1].role !== 'assistant') throw new Error('host locate rows not used');
}

// Host half: prose-only search and prose-only locating (single read per session)
{
  const hostTime = Date.now();
  const textEvent = (type, seq, text, source) => (type === 'user/message'
    ? { type, seq, time: hostTime, data: { source: source ?? { kind: 'user' }, content: [{ type: 'text', text }] } }
    : { type, seq, time: hostTime, data: { message: { content: [{ type: 'text', text }] } } });
  const hostEventSets = {
    'session-a': [
      textEvent('user/message', 1, '请检查 SEARCH 数据'),
      textEvent('assistant/message', 3, 'SEARCH 结论如下'),
      { type: 'tool/result', seq: 5, time: hostTime, data: { message: { content: [{ type: 'text', text: 'SEARCH 1041 hits' }] } } },
      textEvent('assistant/message', 6, '说明如下：\n```\nSEARCH in code\n```\n结束'),
    ],
    'session-b': [
      { type: 'user/message', seq: 2, time: hostTime, data: { source: { kind: 'goal', round: 1 }, content: [{ type: 'text', text: '<goal_round>Objective: SEARCH</goal_round>' }] } },
      { type: 'tool/result', seq: 4, time: hostTime, data: { message: { content: [{ type: 'text', text: 'SEARCH 1041 hits' }] } } },
    ],
    'session-c': [
      textEvent('assistant/message', 6, '说明如下：\n```\nSEARCH in code\n```\n结束'),
    ],
    'session-d': [
      { type: 'assistant/message', seq: 7, time: hostTime, data: { message: { content: [{ type: 'tool-call', name: 'bash', arguments: 'grep SEARCH' }] } } },
    ],
    'session-e': [
      textEvent('user/message', 10, '<available_skills>agent-experience: SEARCH</available_skills>', { kind: 'skill-catalog', form: 'catalog' }),
    ],
    'session-f': [textEvent('user/message', 11, syntheticCodeSnippet)],
    'session-g': [textEvent('assistant/message', 13, `${syntheticTraceFragment} SEARCH`)],
    'session-h': [textEvent('assistant/message', 9, '更深处的 SEARCH 对话')],
  };
  const hostSessionQuery = {
    searchSessions: async () => ({
      items: [
        { header: { id: 'session-a' }, bestMatch: { type: 'user/message', seq: 1, snippet: '请检查 SEARCH 数据' } },
        { header: { id: 'session-b' }, bestMatch: { type: 'user/message', seq: 2, snippet: 'Objective SEARCH' } },
        { header: { id: 'session-c' }, bestMatch: { type: 'assistant/message', seq: 6, snippet: 'SEARCH in code' } },
        { header: { id: 'session-d' }, bestMatch: { type: 'assistant/message', seq: 7, snippet: 'grep SEARCH' } },
        { header: { id: 'session-e' }, bestMatch: { type: 'user/message', seq: 10, snippet: 'agent-experience SEARCH' } },
        { header: { id: 'session-f' }, bestMatch: { type: 'user/message', seq: 11, snippet: syntheticCodeSnippet } },
        { header: { id: 'session-g' }, bestMatch: { type: 'assistant/message', seq: 13, snippet: syntheticTraceFragment } },
        { header: { id: 'session-h' }, bestMatch: { type: 'assistant/message', seq: 9, snippet: '更深处的 SEARCH' } },
        { header: { id: 'subagent-session', origin: 'subagent' }, bestMatch: { type: 'assistant/message', seq: 1, snippet: 'SEARCH dispatch' } },
      ],
      nextCursor: 'cursor-1',
    }),
    observeSession: async (sessionId) => ({ events: hostEventSets[sessionId] ?? [], [Symbol.dispose]: () => {} }),
  };
  const hostRoutes = new Map();
  applyHostPlugin({
    get: (name) => name === 'sessionPersistence' ? {
      list: async () => Object.entries(hostEventSets).map(([id, events]) => ({header: {id}, revision: '1', eventCount: events.length})),
      open: async id => ({read: async () => ({events: hostEventSets[id]}), close: async () => {}}),
    } : undefined,
    effect: (callback) => { callback(); },
    connection: {
      fetch: {
        register: (route) => {
          if (hostRoutes.has(route.path)) throw new Error(`duplicate fetch route ${route.path}`);
          hostRoutes.set(route.path, route);
          return async () => {};
        },
      },
    },
  });
  if (hostRoutes.size !== 2) throw new Error(`expected 2 exact host routes, got ${hostRoutes.size}`);
  const callRoute = async (path, endpoint, payload) => {
    const route = hostRoutes.get(path);
    if (route === undefined) throw new Error(`missing host route ${path}`);
    if (route.methods.includes('POST') === false) throw new Error(`host route ${path} must accept POST`);
    const request = new Request(`http://localhost${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'client-request', rpcId: 'rpc-1', method: endpoint, payload }),
    });
    const response = await route.fetch(request);
    const body = await response.json();
    if (body.type !== 'server-response' || body.rpcId !== 'rpc-1') throw new Error(`bad host response envelope: ${JSON.stringify(body)}`);
    return body.result;
  };

  const located = await callRoute('/api/conversation-history/locate', 'conversation-history/locate', { sessionId: 'session-a', query: 'SEARCH', seq: 1 });
  if (located.ok !== true) throw new Error(`host locate failed: ${JSON.stringify(located)}`);
  if (located.value.found !== true || located.value.anchorSeq !== 1) throw new Error(`host locate must anchor on prose, got ${located.value.anchorSeq}`);
  if (located.value.rows.length < 2 || located.value.rows[0].seq !== 1 || located.value.rows[0].role !== 'user') throw new Error(`host locate rows unexpected: ${JSON.stringify(located.value.rows)}`);
  if (located.value.rows.some((row) => row.seq === 5)) throw new Error('locate rows leaked tool content');
  const fallbackAnchor = await callRoute('/api/conversation-history/locate', 'conversation-history/locate', { sessionId: 'session-a', query: 'SEARCH' });
  if (fallbackAnchor.value.found !== true || fallbackAnchor.value.anchorSeq !== 1) throw new Error('locate without a sequence must fall back to the first prose match');
  const emptyLocate = await callRoute('/api/conversation-history/locate', 'conversation-history/locate', { sessionId: 'session-b', query: 'SEARCH' });
  if (emptyLocate.value.found !== false || emptyLocate.value.rows.length !== 0) throw new Error('session without dialogue prose must not locate');

  const searched = await callRoute('/api/conversation-history/search', 'conversation-history/search', { query: 'SEARCH', limit: 20 });
  if (searched.ok !== true) throw new Error(`host search failed: ${JSON.stringify(searched)}`);
  const bySession = new Map(searched.value.items.map((item) => [item.sessionId, item]));
  for (const expected of ['session-a', 'session-h']) {
    if (!bySession.has(expected)) throw new Error(`host search dropped a prose match: ${expected} (${JSON.stringify(searched.value.items)})`);
  }
  for (const dropped of ['session-b', 'session-c', 'session-d', 'session-e', 'session-f', 'session-g', 'subagent-session']) {
    if (bySession.has(dropped)) throw new Error(`host search kept non-prose content: ${dropped}`);
  }
  if (searched.value.hasMore !== false) throw new Error('complete search must not claim omitted matches');
  if (searched.value.proseFiltered !== true) throw new Error('host search must advertise prose verification');
  if (!bySession.get('session-a').snippet.includes('SEARCH')) throw new Error('snippet must be rebuilt from prose');
  if (!bySession.get('session-h').snippet.includes('更深处的 SEARCH')) throw new Error('deep prose hit snippet missing');

  const badRequest = await hostRoutes.get('/api/conversation-history/search').fetch(new Request('http://localhost/api/conversation-history/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nope: true }),
  }));
  if (badRequest.status !== 400) throw new Error('invalid envelope must be rejected');
}

// stylesheet injection
if (styleTags.length !== 1) throw new Error(`expected one injected stylesheet, got ${styleTags.length}`);
if (!styleTags[0].dataset.pluginCss.includes('/client.css')) throw new Error('stylesheet tag is not plugin-owned');
if (!String(styleTags[0].textContent).includes('--dsw-alias-')) throw new Error('stylesheet does not use theme tokens');

console.log(`OK: dictionaries=${enKeys.length} keys, stylesheet tokens ok, all render branches and keyboard paths passed`);
