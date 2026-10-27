window.__ModuleLoader__.load({
  id: 'dsh-conversation-history',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    /** Dictionary namespace owned by this plugin (the View tab label binds to it). */
    const NS = 'conversation-history';
    /** Stable identifier used for the injected stylesheet tag. */
    const PACKAGE_ID = 'dsh-conversation-history';
    /** Pause after the last keystroke before one Host search; a superseded query aborts the previous one. */
    const SEARCH_DEBOUNCE_MS = 300;
    /** Debounce used after a slow query, so typing does not re-trigger heavy searches. */
    const SEARCH_SLOW_DEBOUNCE_MS = 600;
    /** Give up on a search that never answers, instead of spinning forever. */
    const SEARCH_TIMEOUT_MS = 8000;
    /** Shortest query sent to the Host: broader queries match thousands of documents and stall the ranking. */
    const MIN_QUERY_LENGTH = 2;
    /** A repeated query inside this window renders from the shared cache without another Host round trip. */
    const SEARCH_CACHE_TTL_MS = 300_000;
    /** Bounded client cache so typing backwards through a phrase stays instant without unbounded memory. */
    const SEARCH_CACHE_LIMIT = 40;
    /** Recent conversations shown while the search field is empty. */
    const RECENT_LIMIT = 30;
    /** Conversation-title matches rendered instantly while the message search is in flight. */
    const TITLE_MATCH_LIMIT = 6;
    /** Extra history pages loaded while locating a clicked hit's passage. */
    const CONTEXT_SEEK_PAGES = 8;
    /** A revisited session reuses its extracted context rows for this long. */
    const CONTEXT_CACHE_TTL_MS = 120_000;
    /** Bounded context-row cache. */
    const CONTEXT_CACHE_LIMIT = 5;
    /** Pages added by one "load earlier" click when seeking an older match. */
    const CONTEXT_SEEK_STEP = 8;
    /** Page size requested from the Host dialogue-only search endpoint. */
    const SEARCH_HOST_LIMIT = 100;
    /** Connection RPC channel of the bundle's Host half: exact `/api` Fetch routes. */
    const HOST_CHANNEL = '/api';
    /** Longest text retained per context row (bounds memory and match scans). */
    const CONTEXT_ROW_CHARS = 20_000;
    /** Longest formatted message text rendered before a per-row expand control. */
    const CONTEXT_MESSAGE_CHARS = 8_000;
    const EMPTY_BY_ID = Object.freeze({});
    const EMPTY_ITEMS = Object.freeze([]);

    //#region dictionaries
    /** English copy. */
    const en = {
      'view.history': 'History',
      title: 'Chat history',
      subtitle: 'Search message text across every conversation.',
      'search.label': 'Search chat history',
      'search.placeholder': 'Search chat history',
      'search.clear': 'Clear search',
      'search.searching': 'Searching chat history…',
      'search.updating': 'Updating…',
      'search.indexing': 'Preparing history: {indexed}/{total} conversations. Results update automatically.',
      'search.incomplete': '{count} conversations could not be read; results are incomplete.',
      'search.timeout': 'Search timed out. Please try again.',
      'search.failed': 'Search failed. Please try again.',
      'search.minLength': 'Type at least 2 characters.',
      'search.hostRequired': 'Search is temporarily unavailable.',
      'search.titleMatches': 'Title matches',
      'search.messageMatches': 'Message matches',
      'search.sessionKind': 'Session',
      'search.took': '{ms} ms',
      'search.prevMatch': 'Previous match',
      'search.nextMatch': 'Next match',
      'context.title': 'History context',
      'context.hint': 'Select a result on the left to read its context here.',
      'context.loading': 'Loading context…',
      'context.failed': 'Could not load this conversation.',
      'context.open': 'Open conversation',
      'context.close': 'Close context',
      'context.role.user': 'You',
      'context.role.assistant': 'Assistant',
      'context.notFound': 'The phrase was not found in this conversation.',
      'context.titleHit': 'Matched the conversation title; showing recent messages.',
      'context.empty': 'This conversation has no readable messages.',
      'context.loadMore': 'Show more context',
      'context.seekMore': 'Load earlier messages to find the match',
      'context.expand': 'Show full content',
      'context.collapsedCode': 'Code or table content (collapsed)',
      'context.collapse': 'Collapse content',
      'search.results': '{count} matching conversations',
      'search.resultsOne': '{count} matching conversation',
      'search.more': 'Showing the first {count} matches.',
      'search.emptyFor': 'No conversation text matches “{query}”.',
      'search.groupCount': '{count}',
      'recent.title': 'Recent conversations',
      'recent.hint': 'Type above to search all conversations.',
      'recent.empty': 'No conversations yet. Start one to see it here.',
      'current.badge': 'Current',
      'hit.open': 'Open conversation: {title}',
      'hit.openCurrent': 'This is the current conversation: {title}',
      'result.untitled': 'Untitled conversation',
      'time.justNow': 'just now',
      'time.minutes': '{count} min ago',
      'time.hours': '{count} h ago',
      'time.days': '{count} d ago',
      'time.date': '{date}',
    };

    /** Simplified Chinese copy, key-identical to English. */
    const zh = {
      'view.history': '历史',
      title: '聊天记录',
      subtitle: '跨所有会话搜索消息内容。',
      'search.label': '搜索聊天记录',
      'search.placeholder': '搜索聊天记录',
      'search.clear': '清空搜索',
      'search.searching': '正在搜索聊天记录…',
      'search.updating': '正在更新…',
      'search.indexing': '正在整理历史记录：{indexed}/{total} 个会话。结果会自动更新。',
      'search.incomplete': '{count} 个会话读取失败，当前结果不完整。',
      'search.timeout': '搜索超时，请重试。',
      'search.failed': '搜索失败，请重试。',
      'search.minLength': '至少输入 2 个字符。',
      'search.hostRequired': '搜索暂时不可用。',
      'search.titleMatches': '会话标题命中',
      'search.messageMatches': '消息命中',
      'search.sessionKind': '会话',
      'search.took': '{ms} 毫秒',
      'search.prevMatch': '上一个匹配',
      'search.nextMatch': '下一个匹配',
      'context.title': '历史上下文',
      'context.hint': '点击左侧任意结果，在这里查看它前后的消息。',
      'context.loading': '正在加载上下文…',
      'context.failed': '无法加载该会话内容。',
      'context.open': '打开会话',
      'context.close': '关闭上下文',
      'context.role.user': '你',
      'context.role.assistant': '助手',
      'context.notFound': '该会话中没有找到这个关键词。',
      'context.titleHit': '标题命中该关键词，以下是最近的对话。',
      'context.empty': '该会话没有可显示的消息。',
      'context.loadMore': '显示更多上下文',
      'context.seekMore': '继续加载更早内容以查找匹配',
      'context.expand': '显示完整内容',
      'context.collapsedCode': '代码/表格内容（已折叠）',
      'context.collapse': '收起内容',
      'search.results': '匹配 {count} 个会话',
      'search.resultsOne': '匹配 {count} 个会话',
      'search.more': '仅显示前 {count} 条结果。',
      'search.emptyFor': '没有找到包含「{query}」的对话。',
      'search.groupCount': '{count}',
      'recent.title': '最近的会话',
      'recent.hint': '在上方输入以搜索所有会话。',
      'recent.empty': '还没有会话，开始一个会话后会显示在这里。',
      'current.badge': '当前',
      'hit.open': '打开会话：{title}',
      'hit.openCurrent': '这是当前会话：{title}',
      'result.untitled': '未命名会话',
      'time.justNow': '刚刚',
      'time.minutes': '{count} 分钟前',
      'time.hours': '{count} 小时前',
      'time.days': '{count} 天前',
      'time.date': '{date}',
    };
    //#endregion

    //#region styles
    const CSS = `
.dsh-ch-root {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-base);
}
.dsh-ch-header {
  flex: none;
  padding: 18px 20px 10px;
}
.dsh-ch-headerInner,
.dsh-ch-content {
  width: 100%;
  max-width: 780px;
  margin: 0 auto;
}
.dsh-ch-titleRow {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.dsh-ch-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  line-height: 22px;
  color: var(--dsw-alias-label-primary);
}
.dsh-ch-subtitle {
  margin: 2px 0 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary);
}
.dsh-ch-search {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 0 10px;
  height: 38px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-2);
  transition: border-color 120ms ease;
}
.dsh-ch-search:focus-within {
  border-color: var(--dsw-alias-brand-primary);
}
.dsh-ch-searchIcon {
  flex: none;
  color: var(--dsw-alias-label-secondary);
  display: inline-flex;
}
.dsh-ch-input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: 0;
  outline: 0;
  padding: 0;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 14px;
  line-height: 20px;
}
.dsh-ch-input::placeholder {
  color: var(--dsw-alias-label-secondary);
}
.dsh-ch-input::-webkit-search-cancel-button {
  display: none;
}
.dsh-ch-clear {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
}
.dsh-ch-clear:hover {
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-layer-1);
}
.dsh-ch-clear:focus-visible,
.dsh-ch-row:focus-visible,
.dsh-ch-hit:focus-visible,
.dsh-ch-groupHead:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 1px;
}
.dsh-ch-status {
  min-height: 16px;
  margin-top: 8px;
  font-size: 12px;
  line-height: 16px;
  color: var(--dsw-alias-label-secondary);
}
.dsh-ch-statusError {
  color: var(--dsw-alias-state-error-primary);
}
.dsh-ch-statusBusy {
  display: flex;
  align-items: center;
  gap: 6px;
}
.dsh-ch-dot {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--dsw-alias-brand-primary);
  animation: dsh-ch-pulse 900ms ease-in-out infinite;
}
@keyframes dsh-ch-pulse {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 1; }
}
.dsh-ch-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}
.dsh-ch-content {
  padding: 4px 20px calc(var(--dsh-composer-height, 152px) + 24px);
}
.dsh-ch-section + .dsh-ch-section {
  margin-top: 8px;
}
.dsh-ch-sectionHead {
  margin: 8px 2px 4px;
  font-size: 12px;
  font-weight: 600;
  line-height: 16px;
  color: var(--dsw-alias-label-secondary);
}
.dsh-ch-hint {
  margin: 0 2px 6px;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary);
}
.dsh-ch-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.dsh-ch-row {
  box-sizing: border-box;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  padding: 9px 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.dsh-ch-row:hover,
.dsh-ch-hit:hover,
.dsh-ch-groupHead:hover {
  background: var(--dsw-alias-bg-layer-2);
}
.dsh-ch-rowIcon {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 22px;
  color: var(--dsw-alias-label-secondary);
}
.dsh-ch-rowBody {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}
.dsh-ch-rowTitle {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
  color: var(--dsw-alias-label-primary);
}
.dsh-ch-rowTitleText {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-ch-rowMeta {
  font-size: 12px;
  line-height: 16px;
  color: var(--dsw-alias-label-secondary);
}
.dsh-ch-badge {
  flex: none;
  padding: 0 6px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 999px;
  font-size: 11px;
  line-height: 16px;
  font-weight: 500;
  color: var(--dsw-alias-brand-primary);
}
.dsh-ch-kind {
  flex: none;
  padding: 0 5px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 4px;
  font-size: 10px;
  line-height: 14px;
  color: var(--dsw-alias-label-secondary);
  letter-spacing: 0.02em;
}
.dsh-ch-group {
  margin-top: 8px;
  padding: 4px 6px 6px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 10px;
}
.dsh-ch-groupHead {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.dsh-ch-groupTitle {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
  line-height: 18px;
  color: var(--dsw-alias-label-primary);
}
.dsh-ch-groupCount {
  flex: none;
  min-width: 20px;
  text-align: right;
  font-size: 11px;
  line-height: 16px;
  color: var(--dsw-alias-label-secondary);
}
.dsh-ch-hit {
  box-sizing: border-box;
  display: block;
  width: calc(100% - 28px);
  margin-left: 28px;
  padding: 6px 10px;
  border: 1px solid transparent;
  border-left: 2px solid var(--dsw-alias-border-l2);
  border-radius: 0 8px 8px 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.dsh-ch-snippet {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 0;
  font-size: 13px;
  line-height: 20px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  color: var(--dsw-alias-label-secondary);
}
.dsh-ch-mark {
  background: transparent;
  color: var(--dsw-alias-brand-primary);
  font-weight: 600;
}
.dsh-ch-markCurrent {
  background: var(--dsw-alias-brand-primary);
  color: var(--dsw-alias-bg-base);
  border-radius: 2px;
}
.dsh-ch-nav {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.dsh-ch-navButton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
}
.dsh-ch-navButton:hover:not(:disabled) {
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
}
.dsh-ch-navButton:disabled {
  opacity: 0.4;
  cursor: default;
}
.dsh-ch-navButton:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 1px;
}
.dsh-ch-navCount {
  min-width: 34px;
  text-align: center;
  font-size: 11px;
  line-height: 16px;
  color: var(--dsw-alias-label-secondary);
  font-variant-numeric: tabular-nums;
}
.dsh-ch-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 56px 16px 32px;
  text-align: center;
  color: var(--dsw-alias-label-secondary);
}
.dsh-ch-emptyIcon {
  display: inline-flex;
  color: var(--dsw-alias-label-secondary);
  opacity: 0.8;
  margin-bottom: 4px;
}
.dsh-ch-emptyTitle {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
  color: var(--dsw-alias-label-primary);
}
.dsh-ch-emptyText {
  margin: 0;
  max-width: 360px;
  font-size: 12px;
  line-height: 18px;
}
.dsh-ch-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 24px 12px;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary);
}
.dsh-ch-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--dsw-alias-border-l2);
  border-top-color: var(--dsw-alias-brand-primary);
  border-radius: 50%;
  animation: dsh-ch-spin 700ms linear infinite;
}
@keyframes dsh-ch-spin {
  to { transform: rotate(360deg); }
}
.dsh-ch-body {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
}
.dsh-ch-listPane {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
}
.dsh-ch-listPaneDocked {
  flex: 0 0 46%;
  max-width: 520px;
  border-right: 1px solid var(--dsw-alias-border-l1);
}
.dsh-ch-detailPane {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--dsw-alias-bg-base);
}
.dsh-ch-detailHeader {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.dsh-ch-detailTitle {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
  line-height: 18px;
  color: var(--dsw-alias-label-primary);
}
.dsh-ch-detailAction {
  flex: none;
  padding: 3px 8px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12px;
  line-height: 16px;
  cursor: pointer;
}
.dsh-ch-detailAction:hover {
  background: var(--dsw-alias-bg-layer-2);
}
.dsh-ch-detailAction:focus-visible,
.dsh-ch-contextMore:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 1px;
}
.dsh-ch-detailScroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 10px 14px calc(var(--dsh-composer-height, 152px) + 24px);
}
.dsh-ch-detailHint {
  margin: 4px 2px 10px;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary);
}
.dsh-ch-contextRow {
  padding: 7px 10px;
  margin-bottom: 4px;
  border-radius: 8px;
}
.dsh-ch-contextHit {
  background: var(--dsw-alias-bg-layer-2);
  box-shadow: inset 2px 0 0 var(--dsw-alias-brand-primary);
}
.dsh-ch-contextMeta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
  font-size: 11px;
  line-height: 16px;
  color: var(--dsw-alias-label-secondary);
}
.dsh-ch-contextRole {
  font-weight: 600;
}
.dsh-ch-contextRow-user .dsh-ch-contextRole {
  color: var(--dsw-alias-brand-primary);
}
.dsh-ch-contextMore {
  display: block;
  margin: 6px auto 2px;
  padding: 4px 10px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12px;
  line-height: 16px;
  cursor: pointer;
}
.dsh-ch-contextMore:hover {
  background: var(--dsw-alias-bg-layer-2);
}
.dsh-ch-contextBody {
  min-width: 0;
}
.dsh-ch-contextExpand {
  margin-top: 4px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-brand-primary);
  font: inherit;
  font-size: 12px;
  line-height: 16px;
  cursor: pointer;
}
.dsh-ch-contextExpand:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 1px;
}
.dsh-ch-mdParagraph {
  margin: 0 0 6px;
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-label-primary);
  overflow-wrap: anywhere;
}
.dsh-ch-contextBody > .dsh-ch-mdParagraph:last-child {
  margin-bottom: 0;
}
.dsh-ch-mdHeading {
  margin: 10px 0 4px;
  font-weight: 600;
  line-height: 20px;
  color: var(--dsw-alias-label-primary);
}
.dsh-ch-mdHeading1,
.dsh-ch-mdHeading2 {
  font-size: 15px;
}
.dsh-ch-mdHeading3 {
  font-size: 14px;
}
.dsh-ch-mdHeading4 {
  font-size: 13px;
}
.dsh-ch-mdList {
  margin: 0 0 6px;
  padding-left: 20px;
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-label-primary);
}
.dsh-ch-mdQuote {
  margin: 0 0 6px;
  padding: 2px 10px;
  border-left: 2px solid var(--dsw-alias-border-l2);
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  line-height: 20px;
  white-space: pre-wrap;
}
.dsh-ch-mdTableWrap {
  margin: 4px 0 8px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px;
  overflow-x: auto;
}
.dsh-ch-mdTable {
  border-collapse: collapse;
  width: 100%;
  font-size: 12px;
  line-height: 18px;
}
.dsh-ch-mdTable th,
.dsh-ch-mdTable td {
  padding: 4px 8px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  text-align: left;
  vertical-align: top;
}
.dsh-ch-mdTable th {
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
  font-weight: 600;
  white-space: nowrap;
}
.dsh-ch-mdTable td {
  color: var(--dsw-alias-label-secondary);
}
.dsh-ch-mdTable tbody tr:last-child td {
  border-bottom: 0;
}
.dsh-ch-mdPre {
  margin: 4px 0 8px;
  padding: 8px 10px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
  white-space: pre;
  overflow: auto;
  max-height: 320px;
}
.dsh-ch-mdCode {
  padding: 1px 4px;
  border-radius: 4px;
  background: var(--dsw-alias-bg-layer-2);
  font-size: 12px;
}
.dsh-ch-rowSelected,
.dsh-ch-hitSelected {
  background: var(--dsw-alias-bg-layer-2);
}
.dsh-ch-hitSelected {
  box-shadow: inset 2px 0 0 var(--dsw-alias-brand-primary);
}
@media (max-width: 760px) {
  .dsh-ch-body {
    flex-direction: column;
  }
  .dsh-ch-listPaneDocked {
    flex: 0 0 38%;
    max-width: none;
    border-right: 0;
    border-bottom: 1px solid var(--dsw-alias-border-l1);
  }
}
`;

    /**
     * Insert this plugin's stylesheet once and return its remover.
     * @returns cleanup that removes the style element.
     */
    function insertStyles() {
      if (typeof document === 'undefined') return () => {};
      const tag = document.createElement('style');
      tag.dataset.plugin = PACKAGE_ID;
      tag.dataset.pluginCss = `${PACKAGE_ID}/client.css`;
      tag.textContent = CSS;
      document.head.appendChild(tag);
      return () => {
        tag.remove();
      };
    }
    //#endregion

    //#region helpers
    /** Describe one failed Remote result without assuming a message shape. */
    function describeFailure(error) {
      if (error === undefined || error === null) return 'unknown error';
      if (typeof error === 'string') return error;
      if (typeof error.message === 'string' && error.message !== '') return error.message;
      if (typeof error.code === 'string') return error.code;
      return String(error);
    }

    /** Format one catalog timestamp relative to now, falling back to a local date. */
    function formatUpdated(updatedAt, t) {
      if (typeof updatedAt !== 'number' || !Number.isFinite(updatedAt) || updatedAt <= 0) return '';
      const elapsed = Date.now() - updatedAt;
      if (elapsed < 60 * 1000) return t('time.justNow');
      if (elapsed < 60 * 60 * 1000) return t('time.minutes', { count: Math.floor(elapsed / (60 * 1000)) });
      if (elapsed < 24 * 60 * 60 * 1000) return t('time.hours', { count: Math.floor(elapsed / (60 * 60 * 1000)) });
      if (elapsed < 7 * 24 * 60 * 60 * 1000) return t('time.days', { count: Math.floor(elapsed / (24 * 60 * 60 * 1000)) });
      const date = new Date(updatedAt);
      const sameYear = date.getFullYear() === new Date().getFullYear();
      const formatted = new Intl.DateTimeFormat(undefined, sameYear
        ? { month: 'short', day: 'numeric' }
        : { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
      return t('time.date', { date: formatted });
    }

    /** Escape one literal phrase for use inside a RegExp. */
    function escapeRegExp(text) {
      return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * All case-insensitive occurrences of one phrase, as { start, end } ranges.
     * Whitespace between query words is flexible, matching the Host's query
     * normalization, so counts and highlights agree with what was searched.
     */
    function matchRanges(text, query) {
      const parts = typeof query === 'string' ? query.trim().split(/\s+/).filter(Boolean) : [];
      if (parts.length === 0 || typeof text !== 'string' || text === '') return [];
      const pattern = new RegExp(parts.map(escapeRegExp).join('\\s+'), 'gi');
      const ranges = [];
      let match = pattern.exec(text);
      while (match !== null) {
        ranges.push({ start: match.index, end: match.index + match[0].length });
        if (match[0].length === 0) pattern.lastIndex += 1;
        match = pattern.exec(text);
      }
      return ranges;
    }

    /**
     * Split one snippet into text and highlighted matches.
     * @param text - raw snippet.
     * @param query - non-blank literal search phrase.
     * @returns React children for the snippet paragraph.
     */
    function highlight(text, query) {
      if (typeof text !== 'string' || text === '') return text;
      const ranges = matchRanges(text, query);
      if (ranges.length === 0) return text;
      const parts = [];
      let from = 0;
      ranges.forEach((range, index) => {
        if (range.start > from) parts.push(text.slice(from, range.start));
        parts.push(h('mark', { key: `m${index}`, className: 'dsh-ch-mark' }, text.slice(range.start, range.end)));
        from = range.end;
      });
      if (from < text.length) parts.push(text.slice(from));
      return parts;
    }

    /** Conversation title from the session catalog row, or a localized fallback. */
    function titleOf(row, fallbackId, t) {
      if (row !== undefined && typeof row.displayTitle === 'string' && row.displayTitle !== '') return row.displayTitle;
      return t('result.untitled');
    }

    async function withTimeout(promise, ms) {
      let timer;
      try {
        return await Promise.race([promise, new Promise((resolve, reject) => {
          timer = setTimeout(() => reject(new Error('Request timed out. Please try again.')), ms);
        })]);
      } finally { clearTimeout(timer); }
    }

    /** Monotonic clock for one search round trip. */
    function nowMs() {
      return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
    }

    /** Whole milliseconds elapsed since one {@link nowMs} reading. */
    function elapsedMs(startedAt) {
      return Math.max(0, Math.round(nowMs() - startedAt));
    }

    /** Narrow one Host search result item to the fields this view needs. */
    function normalizeHit(item) {
      return {
        sessionId: typeof item.sessionId === 'string' ? item.sessionId : String(item.sessionId),
        snippet: typeof item.snippet === 'string' ? item.snippet : '',
        seq: typeof item.seq === 'number' ? item.seq : 0,
        eventType: typeof item.type === 'string' ? item.type : '',
      };
    }

    /** Normalized cache key and comparison form for one raw query. */
    function normalizeQueryKey(raw) {
      return raw.trim().toLocaleLowerCase();
    }

    /** Code-point length of one raw query. */
    function queryLength(raw) {
      return Array.from(raw.trim()).length;
    }

    /** Search results shared by every History view instance in this Client run. */
    const searchCache = new globalThis.Map();

    /** Read one cached search result, dropping an expired entry. */
    function readSearchCache(key) {
      const entry = searchCache.get(key);
      if (entry === undefined) return null;
      if (Date.now() - entry.at >= SEARCH_CACHE_TTL_MS) {
        searchCache.delete(key);
        return null;
      }
      return entry.result;
    }

    /** Store one search result and drop the oldest entries beyond the bound. */
    function writeSearchCache(key, result) {
      searchCache.set(key, { result, at: Date.now() });
      while (searchCache.size > SEARCH_CACHE_LIMIT) {
        const oldest = searchCache.keys().next();
        if (oldest.done === true) return;
        searchCache.delete(oldest.value);
      }
    }

    /** Paired blocks the Harness injects into the prompt; they are never dialogue. */
    const INJECTED_BLOCK_PATTERN = /<(system-reminder|available_skills|goal_round)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
    /** Stray opening or closing wrapper tags of the same injected blocks. */
    const INJECTED_TAG_PATTERN = /<\/?(?:system-reminder|available_skills|goal_round)\b[^>]*>/gi;

    /** Known machine-injected boilerplate and injected-block fragments the index cannot type-tag. */
    const INJECTED_SNIPPET_MARKERS = [
      'Current working directory:',
      'Current DSH file policy:',
      'Current DeepSeek Harness implementation checkout:',
      'Current runtime context. This snapshot supersedes',
      'Approval prompts are disabled in this session',
      'Approval policy:',
      'You are the Team Lead named',
      'Time sampled while preparing turn',
      'A skill is a reusable set of task-specific instructions',
      'The following skills are available',
      'model-facing tool definition',
      'task-specific instructions',
      'agent-experience',
      'available_skills',
      'lable_skills',
      'system-reminder',
      'goal_round',
      'runtime-context',
      'skill-catalog',
    ];
    /** Partial injected-block fragments (snippets truncate wrappers). */
    const INJECTED_FRAGMENT_PATTERN = /(?:^|[.\s])[a-z_-]*(?:skills?|reminder|round)\s*>/i;
    /** Whether a sanitized snippet is tool-argument JSON, code, or template noise. */
    function looksCodeishSnippet(text) {
  if (text.includes('{"') || text.includes('["')) return true;
  if (text.includes('"command"') || text.includes('"file_path"') || text.includes('"pattern"')) return true;
  if (text.includes('```')) return true;
  if (text.includes('\\"') || text.includes('\\n') || text.includes('\\t')) return true;
  if (/\w+\.\w+\s*\(/.test(text)) return true;
  if (/\b(?:def|class|import|lambda)\b/.test(text)) return true;
  if (/[{}]/.test(text)) return true;
  if (/\[[^\]]{0,60}\]\s*=/.test(text)) return true;
  if (/[A-Za-z_]\w*\s*=\s*[^=]/.test(text)) return true;
  if (/[)\]}]\s*\.\s*\w+\(/.test(text)) return true;
  if (text.includes('=>') || text.includes('();') || text.includes('function(')) return true;
  if (text.includes('</') || text.includes('/>')) return true;
  if (/\(L\d{1,5}\)/.test(text)) return true;
  if (/'[a-z][a-z-]*\/[a-z][a-z-]*'/.test(text)) return true;
  return false;
    }

    /** Whether a sanitized snippet is machine-injected boilerplate. */
    function looksInjectedSnippet(text) {
      for (const marker of INJECTED_SNIPPET_MARKERS) {
        if (text.includes(marker)) return true;
      }
      return INJECTED_FRAGMENT_PATTERN.test(text);
    }

    /**
     * Whether a human message is dominated by pasted code/tables rather than
     * natural language. Such context rows fold instead of dumping code.
     */
    function isCodeDominated(text) {
      if (typeof text !== 'string' || text.length < 120) return false;
      if (text.includes('\\"') || text.includes('\\n')) return true;
      if (text.includes('```')) return true;
      let codeChars = 0;
      for (const char of text) {
        if ('{}[]()=;<>\\'.includes(char)) codeChars += 1;
      }
      return codeChars / text.length > 0.06;
    }

    /** Whether one raw result snippet is clean natural-language dialogue prose. */
    function isCleanSnippet(raw) {
      const text = stripInjectedBlocks(typeof raw === 'string' ? raw : '');
      if (text === '') return false;
      if (looksInjectedSnippet(text)) return false;
      if (looksCodeishSnippet(text)) return false;
      return true;
    }

    /**
     * Strip Harness-injected prompt wrappers from text shown to the reader.
     * Display-only: matching still runs on the raw event text.
     * @param text - raw snippet or message text.
     * @returns the text without injected wrapper blocks and stray tags.
     */
    function stripInjectedBlocks(text) {
      if (typeof text !== 'string' || text === '') return '';
      return text
        .replace(INJECTED_BLOCK_PATTERN, ' ')
        .replace(INJECTED_TAG_PATTERN, ' ')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }

    /** Drop the oldest context-cache entry until the cache fits its bound. */
    function pruneContextCache(cache) {
      while (cache.size > CONTEXT_CACHE_LIMIT) {
        const oldest = cache.keys().next();
        if (oldest.done === true) return;
        cache.delete(oldest.value);
      }
    }

    /** Join the non-empty text parts of one session event's semantic content. */
    function joinContextText(parts) {
      return parts
        .filter((part) => typeof part === 'string')
        .map((part) => part.trim())
        .filter((part) => part !== '')
        .join('\n');
    }

    /** Extract the prose of one user/assistant content block list (tool calls render as their own rows). */
    function contentToText(content) {
      if (!Array.isArray(content)) return '';
      const parts = [];
      for (const block of content) {
        if (block === null || typeof block !== 'object') continue;
        if (block.type === 'text' && typeof block.text === 'string') parts.push(block.text);
      }
      return joinContextText(parts);
    }

    /**
     * Project one durable session event to a conversation row. Only the user and
     * assistant round trip is shown; tool calls and tool results are search and
     * anchor material, never rendered.
     */
    function contextRowOf(event) {
      if (event === null || typeof event !== 'object') return null;
      const data = event.data !== null && typeof event.data === 'object' ? event.data : null;
      if (data === null) return null;
      let role = '';
      let text = '';
      if (event.type === 'user/message') {
        // Only human prompts are dialogue. Runtime context, goal rounds,
        // instruction baselines, approvals, and other injected notices carry a
        // non-"user" source kind and stay out of the pane.
        const sourceKind = data.source !== null && typeof data.source === 'object' ? data.source.kind : undefined;
        if (typeof sourceKind === 'string' && sourceKind !== 'user') return null;
        role = 'user';
        text = contentToText(data.content);
      } else if (event.type === 'assistant/message' && data.message !== null && typeof data.message === 'object') {
        role = 'assistant';
        text = contentToText(data.message.content);
      }
      if (role === '' || text === '') return null;
      return {
        seq: typeof event.seq === 'number' ? event.seq : 0,
        time: typeof event.time === 'number' ? event.time : 0,
        role,
        text: text.length <= CONTEXT_ROW_CHARS ? text : text.slice(0, CONTEXT_ROW_CHARS),
      };
    }

    /** Searchable text of any event, including tool messages, for page seeking only. */
    function eventTextAny(event) {
      if (event === null || typeof event !== 'object') return '';
      const data = event.data !== null && typeof event.data === 'object' ? event.data : null;
      if (data === null) return '';
      if (event.type === 'user/message') return contentToText(data.content);
      if (event.type === 'assistant/message' && data.message !== null && typeof data.message === 'object') return contentToText(data.message.content);
      if (event.type === 'tool/call') return joinContextText([data.name, data.arguments]);
      if (event.type === 'tool/result') {
        const message = data.message !== null && typeof data.message === 'object' ? data.message : null;
        const error = data.error !== null && typeof data.error === 'object' ? data.error : null;
        return joinContextText([
          message === null ? '' : contentToText(message.content),
          error === null ? '' : error.name,
          error === null ? '' : error.code,
        ]);
      }
      return '';
    }

    /** Project one loaded event list into conversation rows for the context pane. */
    function contextRowsOf(events) {
      const rows = [];
      if (!Array.isArray(events)) return rows;
      for (const event of events) {
        const row = contextRowOf(event);
        if (row !== null) rows.push(row);
      }
      return rows;
    }

    /** Short local time label for one context row. */
    function formatClock(time) {
      if (typeof time !== 'number' || !Number.isFinite(time)) return '';
      return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(time));
    }

    /** Append one plain run with every search phrase highlighted; one is the active match. */
    function pushHighlighted(parts, text, query, counter) {
      if (typeof text !== 'string' || text === '') return;
      const ranges = matchRanges(text, query);
      if (ranges.length === 0) {
        parts.push(text);
        return;
      }
      let from = 0;
      for (const range of ranges) {
        if (range.start > from) parts.push(text.slice(from, range.start));
        const occurrence = counter.value;
        const current = typeof counter.focus === 'number' && counter.focus >= 0 && counter.focus === occurrence;
        parts.push(h('mark', {
          key: `mk-${occurrence}`,
          className: current ? 'dsh-ch-mark dsh-ch-markCurrent' : 'dsh-ch-mark',
          'data-current-match': current ? 'true' : undefined,
        }, text.slice(range.start, range.end)));
        counter.value = occurrence + 1;
        from = range.end;
      }
      if (from < text.length) parts.push(text.slice(from));
    }

    /** Inline Markdown: code spans, bold, emphasis, with query highlighting in plain runs. */
    function inlineParts(text, query, counter) {
      const input = typeof text === 'string' ? text : '';
      const parts = [];
      const pattern = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g;
      let last = 0;
      let match = pattern.exec(input);
      while (match !== null) {
        if (match.index > last) pushHighlighted(parts, input.slice(last, match.index), query, counter);
        const token = match[0];
        if (token.charAt(0) === '`') {
          const children = [];
          pushHighlighted(children, token.slice(1, -1), query, counter);
          parts.push(h('code', { key: `ic-${match.index}`, className: 'dsh-ch-mdCode' }, children));
        } else if (token.startsWith('**')) {
          const children = [];
          pushHighlighted(children, token.slice(2, -2), query, counter);
          parts.push(h('strong', { key: `ib-${match.index}` }, children));
        } else {
          const children = [];
          pushHighlighted(children, token.slice(1, -1), query, counter);
          parts.push(h('em', { key: `ii-${match.index}` }, children));
        }
        last = pattern.lastIndex;
        match = pattern.exec(input);
      }
      if (last < input.length) pushHighlighted(parts, input.slice(last), query, counter);
      return parts;
    }

    /** Whether one line is a Markdown table separator row (|---|:--:|). */
    function isTableSeparator(line) {
      return typeof line === 'string' && line.includes('|') && line.includes('-') && /^[\s|:\-]+$/.test(line);
    }

    /** Split one pipe-table row into trimmed cells. */
    function splitTableRow(line) {
      let trimmed = line.trim();
      if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
      if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1);
      return trimmed.split('|').map((cell) => cell.trim());
    }

    /** Whether a line begins a non-paragraph Markdown block. */
    function startsMarkdownBlock(line, next) {
      if (line.trim() === '') return true;
      if (/^\s*```/.test(line)) return true;
      if (/^#{1,6}\s/.test(line)) return true;
      if (/^\s*>/.test(line)) return true;
      if (/^(\s*)([-*+]|\d+[.)])\s+/.test(line)) return true;
      return line.includes('|') && isTableSeparator(next);
    }

    /**
     * Render the Markdown subset that session transcripts actually use: fenced
     * code, ATX headings, pipe tables, lists, blockquotes, paragraphs, plus
     * inline code/bold/emphasis. Plain runs highlight the search phrase.
     * Unknown syntax falls through as paragraph text, never throws.
     * @param text - message text.
     * @param query - search phrase to highlight.
     * @param focus - zero-based occurrence of `query` to mark as the active match.
     * @returns block elements.
     */
    function markdownBlocks(text, query, focus) {
      const counter = { value: 0, focus: typeof focus === 'number' && focus >= 0 ? focus : -1 };
      const lines = (typeof text === 'string' ? text : '').split('\n');
      const blocks = [];
      let index = 0;
      const keyFor = (kind) => `${kind}-${blocks.length}`;
      while (index < lines.length) {
        const line = lines[index];
        if (line.trim() === '') { index += 1; continue; }
        if (/^\s*```/.test(line)) {
          const code = [];
          index += 1;
          while (index < lines.length && !/^\s*```/.test(lines[index])) { code.push(lines[index]); index += 1; }
          if (index < lines.length) index += 1;
          const codeChildren = [];
          pushHighlighted(codeChildren, code.join('\n'), query, counter);
          blocks.push(h('pre', { key: keyFor('pre'), className: 'dsh-ch-mdPre' }, h('code', {}, codeChildren)));
          continue;
        }
        const heading = /^(#{1,6})\s+(.*)$/.exec(line);
        if (heading !== null) {
          const level = Math.min(heading[1].length, 4);
          blocks.push(h('div', {
            key: keyFor('h'),
            className: `dsh-ch-mdHeading dsh-ch-mdHeading${level}`,
          }, inlineParts(heading[2], query, counter)));
          index += 1;
          continue;
        }
        if (line.includes('|') && isTableSeparator(lines[index + 1])) {
          const header = splitTableRow(line);
          const rows = [];
          index += 2;
          while (index < lines.length && lines[index].trim() !== '' && lines[index].includes('|')) {
            rows.push(splitTableRow(lines[index]));
            index += 1;
          }
          blocks.push(h('div', { key: keyFor('table'), className: 'dsh-ch-mdTableWrap' },
            h('table', { className: 'dsh-ch-mdTable' },
              h('thead', {}, h('tr', {}, header.map((cell, cellIndex) => h('th', { key: `h${cellIndex}` }, inlineParts(cell, query, counter))))),
              h('tbody', {}, rows.map((row, rowIndex) => h('tr', { key: `r${rowIndex}` }, row.map((cell, cellIndex) => h('td', { key: `c${cellIndex}` }, inlineParts(cell, query, counter)))))))));
          continue;
        }
        if (/^\s*>/.test(line)) {
          const quoted = [];
          while (index < lines.length && /^\s*>/.test(lines[index])) {
            quoted.push(lines[index].replace(/^\s*>\s?/, ''));
            index += 1;
          }
          blocks.push(h('blockquote', { key: keyFor('quote'), className: 'dsh-ch-mdQuote' }, inlineParts(quoted.join('\n'), query, counter)));
          continue;
        }
        const listItem = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line);
        if (listItem !== null) {
          const ordered = /^\d/.test(listItem[2]);
          const items = [];
          while (index < lines.length) {
            const item = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(lines[index]);
            if (item === null) break;
            items.push(h('li', { key: `li${items.length}` }, inlineParts(item[3], query, counter)));
            index += 1;
          }
          blocks.push(h(ordered ? 'ol' : 'ul', { key: keyFor('list'), className: 'dsh-ch-mdList' }, items));
          continue;
        }
        const paragraph = [];
        while (index < lines.length && !startsMarkdownBlock(lines[index], lines[index + 1])) {
          paragraph.push(lines[index]);
          index += 1;
        }
        if (paragraph.length === 0) {
          paragraph.push(lines[index]);
          index += 1;
        }
        const children = [];
        paragraph.forEach((paragraphLine, lineIndex) => {
          if (lineIndex > 0) children.push(h('br', { key: `br${lineIndex}` }));
          for (const node of inlineParts(paragraphLine, query, counter)) children.push(node);
        });
        blocks.push(h('p', { key: keyFor('p'), className: 'dsh-ch-mdParagraph' }, children));
      }
      return blocks;
    }
    //#endregion

    //#region icons
    function SearchIcon() {
      return h('svg', {
        viewBox: '0 0 16 16', width: 16, height: 16, 'aria-hidden': true, focusable: 'false',
      }, h('circle', { cx: 7, cy: 7, r: 4.5, fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 }),
      h('path', { d: 'M10.4 10.4 14 14', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' }));
    }

    function ClearIcon() {
      return h('svg', {
        viewBox: '0 0 16 16', width: 14, height: 14, 'aria-hidden': true, focusable: 'false',
      }, h('path', { d: 'M4 4l8 8M12 4l-8 8', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' }));
    }

    function ChevronLeftIcon() {
      return h('svg', {
        viewBox: '0 0 16 16', width: 14, height: 14, 'aria-hidden': true, focusable: 'false',
      }, h('path', { d: 'M10 3 5 8l5 5', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }));
    }

    function ChevronRightIcon() {
      return h('svg', {
        viewBox: '0 0 16 16', width: 14, height: 14, 'aria-hidden': true, focusable: 'false',
      }, h('path', { d: 'M6 3l5 5-5 5', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }));
    }

    function BubbleIcon({ size = 14 }) {
      return h('svg', {
        viewBox: '0 0 16 16', width: size, height: size, 'aria-hidden': true, focusable: 'false',
      }, h('path', {
        d: 'M3 2.5h10A1.5 1.5 0 0 1 14.5 4v6A1.5 1.5 0 0 1 13 11.5H7.6L4.5 14v-2.5H3A1.5 1.5 0 0 1 1.5 10V4A1.5 1.5 0 0 1 3 2.5Z',
        fill: 'none', stroke: 'currentColor', strokeWidth: 1.3, strokeLinejoin: 'round',
      }));
    }

    function HistoryIcon() {
      return h('svg', {
        viewBox: '0 0 32 32', width: 30, height: 30, 'aria-hidden': true, focusable: 'false',
      }, h('path', {
        d: 'M5 9.5A3.5 3.5 0 0 1 8.5 6h15A3.5 3.5 0 0 1 27 9.5v10a3.5 3.5 0 0 1-3.5 3.5H14l-6 4.5V23H8.5A3.5 3.5 0 0 1 5 19.5Z',
        fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinejoin: 'round',
      }), h('circle', { cx: 13.5, cy: 14.5, r: 3.8, fill: 'none', stroke: 'currentColor', strokeWidth: 1.6 }),
      h('path', { d: 'M16.4 17.4 19.5 20.5', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' }));
    }
    //#endregion

    //#region view
    /**
     * The `history` Conversation View: search message text across every Session
     * through the Host's visible-message index, or reopen a recent Conversation.
     *
     * @param props - Session scope (`sessionId`), the standard `useSessions`
     *   selector hook, this plugin's locale seat (`t`), and the injected Host
     *   operations.
     * @returns the search toolbar above a scrollable result area.
     */
    function ConversationHistoryView(props) {
      const { sessionId, useSessions, searchHistory, openConversation, loadSessionContext } = props;
      const t = typeof props.t === 'function' ? props.t : (key) => key;

      const byId = useSessions((snapshot) => (snapshot === undefined || snapshot === null ? EMPTY_BY_ID : snapshot.byId));
      const [query, setQuery] = React.useState('');
      const [result, setResult] = React.useState(null);
      const [status, setStatus] = React.useState('idle');
      const [errorMessage, setErrorMessage] = React.useState('');
      const [activeIndex, setActiveIndex] = React.useState(0);
      const [selected, setSelected] = React.useState(null);
      const [context, setContext] = React.useState({ kind: 'idle' });
      const [expand, setExpand] = React.useState(0);
      const [expandedRows, setExpandedRows] = React.useState(() => new globalThis.Set());
      const [currentMatch, setCurrentMatch] = React.useState(0);
      const [seekPages, setSeekPages] = React.useState(CONTEXT_SEEK_PAGES);
      const inputRef = React.useRef(null);
      const requestRef = React.useRef(0);
      const abortRef = React.useRef(null);
      const contextCacheRef = React.useRef(new globalThis.Map());
      const paneRef = React.useRef(null);
      const slowSearchRef = React.useRef(false);

      React.useEffect(() => {
        const node = inputRef.current;
        if (node !== null && typeof node.focus === 'function') node.focus();
      }, []);

      React.useEffect(() => {
        const raw = query.trim();
        const key = normalizeQueryKey(raw);
        abortRef.current?.abort();
        abortRef.current = null;
        requestRef.current += 1;
        const token = requestRef.current;
        setActiveIndex(0);
        if (raw === '') {
          setStatus('idle');
          setErrorMessage('');
          setResult(null);
          setSelected(null);
          return undefined;
        }
        if (queryLength(raw) < MIN_QUERY_LENGTH) {
          setStatus('idle');
          setErrorMessage('');
          setResult(null);
          return undefined;
        }
        const cached = readSearchCache(key);
        if (cached !== null) {
          setResult(cached);
          setStatus('idle');
          setErrorMessage('');
        }
        const controller = new AbortController();
        abortRef.current = controller;
        setStatus('searching');
        setErrorMessage('');
        let retryTimer;
        let generation;
        let deadline;
        const timer = setTimeout(() => {
          const run = async () => {
            const startedAt = nowMs();
            let timedOut = false;
            const timeout = new Promise((resolve, reject) => {
              deadline = setTimeout(() => {
                timedOut = true;
                controller.abort();
                reject(new Error(t('search.timeout')));
              }, SEARCH_TIMEOUT_MS);
            });
            try {
              const response = await Promise.race([searchHistory(raw, controller.signal, generation), timeout]);
              if (timedOut === true) {
                if (token === requestRef.current) {
                  setStatus('error');
                  setErrorMessage(t('search.timeout'));
                }
                return;
              }
              if (token !== requestRef.current || controller.signal.aborted) return;
              if (response !== undefined && response !== null && response.ok === true) {
                const value = response.value === undefined || response.value === null ? {} : response.value;
                const items = Array.isArray(value.items) ? value.items.map(normalizeHit) : EMPTY_ITEMS;
                const next = {
                  query: raw,
                  items,
                  hasMore: value.hasMore === true,
                  indexing: value.indexing === true,
                  generation: value.generation,
                  progress: value.progress,
                  failed: value.failed || 0,
                  tookMs: elapsedMs(startedAt),
                  hosted: response.hosted === true,
                  hostUnavailable: response.hostUnavailable === true,
                };
                slowSearchRef.current = next.tookMs > 900;
                if (!next.indexing && !next.failed && !next.hostUnavailable) writeSearchCache(key, next);
                setResult(next);
                setStatus('idle');
                if (next.indexing) {
                  generation = next.generation;
                  retryTimer = setTimeout(run, 800);
                }
              } else if (controller.signal.aborted === false) {
                const message = describeFailure(response === undefined || response === null ? undefined : response.error);
                console.warn('[conversation-history] search failed:', message);
                setStatus('error');
                setErrorMessage(message);
              }
            } catch (error) {
              if (timedOut === true) {
                if (token === requestRef.current) {
                  setStatus('error');
                  setErrorMessage(t('search.timeout'));
                }
                return;
              }
              if (token !== requestRef.current || controller.signal.aborted) return;
              const message = describeFailure(error);
              console.warn('[conversation-history] search failed:', message);
              setStatus('error');
              setErrorMessage(message);
            } finally {
              clearTimeout(deadline);
            }
          };
          run();
        }, slowSearchRef.current ? SEARCH_SLOW_DEBOUNCE_MS : SEARCH_DEBOUNCE_MS);
        return () => {
          clearTimeout(timer);
          clearTimeout(retryTimer);
          clearTimeout(deadline);
          controller.abort();
        };
      }, [query, searchHistory]);

      React.useEffect(() => {
        if (selected === null) {
          setContext({ kind: 'idle' });
          return undefined;
        }
        const cacheKey = `${selected.sessionId}\u0000${selected.query}\u0000${selected.snippet}\u0000${seekPages}`;
        const cached = contextCacheRef.current.get(cacheKey);
        if (cached !== undefined && Date.now() - cached.at < CONTEXT_CACHE_TTL_MS) {
          setContext({ kind: 'ready', ...cached.value });
          setCurrentMatch(0);
          return undefined;
        }
        let alive = true;
        setContext({ kind: 'loading' });
        const load = async () => {
          try {
            const value = await withTimeout(loadSessionContext(selected.sessionId, selected.query, seekPages, selected.snippet, {
              kind: selected.kind,
              seq: selected.seq,
            }), SEARCH_TIMEOUT_MS);
            if (!alive) return;
            contextCacheRef.current.set(cacheKey, { value, at: Date.now() });
            pruneContextCache(contextCacheRef.current);
            setContext({ kind: 'ready', ...value });
            setCurrentMatch(0);
          } catch (error) {
            if (!alive) return;
            const message = describeFailure(error);
            console.warn('[conversation-history] context load failed:', message);
            setContext({ kind: 'error', message });
          }
        };
        load();
        return () => {
          alive = false;
        };
      }, [selected, loadSessionContext, seekPages]);

      React.useEffect(() => {
        if (result === null || selected === null) return;
        const nextQuery = result.query.trim();
        if (nextQuery === '' || normalizeQueryKey(nextQuery) === normalizeQueryKey(selected.query)) return;
        const nextItem = result.items.find((item) => item.sessionId === selected.sessionId && (result.hosted === true || isCleanSnippet(item.snippet)));
        if (nextItem === undefined) {
          setSelected(null);
          return;
        }
        setSelected({ ...selected, query: nextQuery, snippet: nextItem.snippet, seq: typeof nextItem.seq === 'number' ? nextItem.seq : 0, kind: 'message' });
        setCurrentMatch(0);
      }, [result]);

      React.useEffect(() => {
        if (selected === null || result === null) return;
        if (selected.kind !== 'message') return;
        const stillMatched = result.items.some((item) => item.sessionId === selected.sessionId && (result.hosted === true || isCleanSnippet(item.snippet)));
        if (stillMatched === false) setSelected(null);
      }, [result, selected]);

      React.useEffect(() => {
        if (context.kind !== 'ready') return;
        const pane = paneRef.current;
        if (pane === null || typeof pane.querySelector !== 'function') return;
        const target = pane.querySelector('[data-current-match="true"]')
          ?? pane.querySelector('[data-context-hit="true"]');
        if (target === null) return;
        try {
          const paneRect = pane.getBoundingClientRect();
          const targetRect = target.getBoundingClientRect();
          pane.scrollTop += targetRect.top - paneRect.top - pane.clientHeight * 0.35;
        } catch (error) {
          if (typeof target.scrollIntoView === 'function') target.scrollIntoView({ block: 'center' });
        }
      }, [context, expand, currentMatch, expandedRows]);

      const recents = React.useMemo(() => {
        if (byId === undefined || byId === null) return EMPTY_ITEMS;
        const rows = [];
        for (const key of Object.keys(byId)) {
          const row = byId[key];
          if (row === undefined || row === null) continue;
          if (row.blank === true) continue;
          if (row.origin === 'subagent') continue;
          rows.push(row);
        }
        rows.sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0));
        return rows.slice(0, RECENT_LIMIT);
      }, [byId]);

      const raw = query.trim();
      const titleMatches = React.useMemo(() => {
        const key = normalizeQueryKey(raw);
        if (key === '' || byId === undefined || byId === null) return EMPTY_ITEMS;
        const rows = [];
        for (const id of Object.keys(byId)) {
          const row = byId[id];
          if (row === undefined || row === null || row.blank === true) continue;
          if (row.origin === 'subagent') continue;
          const title = typeof row.displayTitle === 'string' ? row.displayTitle : '';
          if (title.toLocaleLowerCase().includes(key)) rows.push(row);
        }
        rows.sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0));
        return rows.slice(0, TITLE_MATCH_LIMIT);
      }, [byId, raw]);

      const groups = React.useMemo(() => {
        if (result === null) return EMPTY_ITEMS;
        const order = [];
        const map = new globalThis.Map();
        for (const item of result.items) {
          if (result.hosted !== true && isCleanSnippet(item.snippet) === false) continue;
          const row = byId !== undefined && byId !== null ? byId[item.sessionId] : undefined;
          if (row !== undefined && row !== null && row.origin === 'subagent') continue;
          let group = map.get(item.sessionId);
          if (group === undefined) {
            group = { sessionId: item.sessionId, items: [] };
            map.set(item.sessionId, group);
            order.push(group);
          }
          group.items.push(item);
        }
        return order;
      }, [result, byId]);

      const currentId = typeof sessionId === 'string' ? sessionId : '';
      const titleFor = (id) => titleOf(byId?.[id], id, t);

      const open = (id) => {
        if (typeof id !== 'string' || id === '') return;
        try {
          openConversation(id);
        } catch (error) {
          console.error('[conversation-history] could not open conversation:', error);
        }
      };

      const select = (targetSessionId, highlightQuery, snippet, kind, seq) => {
        if (typeof targetSessionId !== 'string' || targetSessionId === '') return;
        const nextQuery = typeof highlightQuery === 'string' ? highlightQuery : '';
        setSelected({
          sessionId: targetSessionId,
          query: nextQuery,
          snippet: typeof snippet === 'string' ? snippet : '',
          kind: kind === 'session' ? 'session' : 'message',
          seq: typeof seq === 'number' ? seq : 0,
        });
        setExpand(0);
        setCurrentMatch(0);
        setSeekPages(CONTEXT_SEEK_PAGES);
      };

      const contextRowNode = (row, index) => {
        const absoluteIndex = visibleContext === null ? index : visibleContext.start + index;
        const isHit = activeEntry !== null
          ? activeEntry.rowIndex === absoluteIndex
          : visibleContext !== null && visibleContext.focusRow === absoluteIndex;
        const focusOccurrence = activeEntry !== null && activeEntry.rowIndex === absoluteIndex ? activeEntry.occurrence : -1;
        const rowKey = `ctx-${row.seq}-${absoluteIndex}`;
        const expanded = expandedRows.has(rowKey) || (row.seq === context.anchorSeq && matchRanges(typeof row.text === 'string' ? row.text : '', selected?.query).some(range => range.end > CONTEXT_MESSAGE_CHARS));
        const text = stripInjectedBlocks(typeof row.text === 'string' ? row.text : '');
        const folded = row.role === 'user' && isCodeDominated(text);
        const expandable = folded === false && text.length > CONTEXT_MESSAGE_CHARS;
        const shown = expandable && !expanded ? text.slice(0, CONTEXT_MESSAGE_CHARS) : text;
        const highlightQuery = selected === null ? '' : selected.query;
        const roleLabel = row.role === 'assistant' ? t('context.role.assistant') : t('context.role.user');
        return h('div', {
          key: rowKey,
          className: isHit ? 'dsh-ch-contextRow dsh-ch-contextHit' : `dsh-ch-contextRow dsh-ch-contextRow-${row.role}`,
          'data-context-hit': isHit ? 'true' : undefined,
        },
        h('div', { className: 'dsh-ch-contextMeta' },
          h('span', { className: 'dsh-ch-contextRole' }, roleLabel),
          row.time ? h('span', {}, formatClock(row.time)) : null),
        h('div', { className: 'dsh-ch-contextBody' }, folded
          ? h('p', { className: 'dsh-ch-detailHint' }, t('context.collapsedCode'))
          : markdownBlocks(shown, highlightQuery, focusOccurrence)),
        expandable ? h('button', {
          type: 'button',
          className: 'dsh-ch-contextExpand',
          onClick: () => {
            setExpandedRows((current) => {
              const next = new globalThis.Set(current);
              if (next.has(rowKey)) next.delete(rowKey);
              else next.add(rowKey);
              return next;
            });
          },
        }, expanded ? t('context.collapse') : t('context.expand')) : null);
      };

      const conversationRow = (row, key) => {
        const isCurrent = row.id === currentId;
        const isSelected = selected !== null && selected.sessionId === row.id;
        const title = titleOf(row, row.id, t);
        return h('li', { key },
          h('button', {
            type: 'button',
            className: isSelected ? 'dsh-ch-row dsh-ch-rowSelected' : 'dsh-ch-row',
            'aria-label': isCurrent ? t('hit.openCurrent', { title }) : t('hit.open', { title }),
            'aria-current': isCurrent ? 'true' : undefined,
            'aria-pressed': isSelected ? 'true' : undefined,
            onClick: () => select(row.id, raw, '', 'session', 0),
          },
          h('span', { className: 'dsh-ch-rowIcon', 'aria-hidden': 'true' }, h(BubbleIcon, {})),
          h('span', { className: 'dsh-ch-rowBody' },
            h('span', { className: 'dsh-ch-rowTitle' },
              h('span', { className: 'dsh-ch-rowTitleText' }, highlight(title, raw)),
              h('span', { className: 'dsh-ch-kind' }, t('search.sessionKind')),
              isCurrent ? h('span', { className: 'dsh-ch-badge' }, t('current.badge')) : null),
            h('span', { className: 'dsh-ch-rowMeta' }, formatUpdated(row.updatedAt, t)))));
      };

      const flatTargets = React.useMemo(() => {
        const targets = [];
        for (const row of titleMatches) targets.push({ sessionId: row.id, kind: 'session' });
        for (const group of groups) for (const item of group.items) targets.push({ ...item, kind: 'message' });
        return targets;
      }, [groups, titleMatches]);

      const fallbackTargets = recents;
      const targetCount = raw === '' ? fallbackTargets.length : flatTargets.length;
      const onInputKeyDown = (event) => {
        if (event.key === 'Escape') {
          if (selected !== null) {
            event.preventDefault();
            setSelected(null);
            return;
          }
          if (query !== '') {
            event.preventDefault();
            setQuery('');
          }
          return;
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          if (targetCount === 0) return;
          event.preventDefault();
          const delta = event.key === 'ArrowDown' ? 1 : -1;
          setActiveIndex((current) => {
            const next = current + delta;
            if (next < 0) return targetCount - 1;
            if (next >= targetCount) return 0;
            return next;
          });
          return;
        }
        if (event.key === 'Enter') {
          const targets = raw === '' ? fallbackTargets : flatTargets;
          const target = targets[activeIndex];
          if (target === undefined || target === null) return;
          event.preventDefault();
          select(typeof target.sessionId === 'string' ? target.sessionId : target.id, raw, typeof target.snippet === 'string' ? target.snippet : '', target.kind === 'session' ? 'session' : 'message', typeof target.seq === 'number' ? target.seq : 0);
        }
      };

      const searching = status === 'searching';
      const displayQuery = result === null ? raw : result.query;

      let statusText = '';
      let statusError = false;
      if (status === 'error') {
        statusText = errorMessage || t('search.failed');
        statusError = true;
      } else if (searching) {
        statusText = result !== null ? t('search.updating') : t('search.searching');
      } else if (raw !== '' && queryLength(raw) < MIN_QUERY_LENGTH) {
        statusText = t('search.minLength');
      } else if (result !== null && result.hostUnavailable === true) {
        statusText = '';
      } else if (result !== null && result.indexing) {
        statusText = t('search.indexing', result.progress || { indexed: 0, total: 0 });
      } else if (result !== null) {
        const count = groups.reduce((total, group) => total + group.items.length, 0);
        statusText = count === 1 ? t('search.resultsOne', { count }) : t('search.results', { count });
        if (typeof result.tookMs === 'number' && result.tookMs > 0) statusText = `${statusText} · ${t('search.took', { ms: result.tookMs })}`;
        if (result.failed) statusText += ` · ${t('search.incomplete', { count: result.failed })}`;
        if (result.hasMore) statusText = `${statusText} · ${t('search.more', { count })}`;
      }

      const titleSection = raw === '' || titleMatches.length === 0 ? null
        : h('section', { className: 'dsh-ch-section', 'aria-label': t('search.titleMatches') },
          h('div', { className: 'dsh-ch-sectionHead' }, t('search.titleMatches')),
          h('ul', { className: 'dsh-ch-list' }, titleMatches.map((row) => conversationRow(row, `title-${row.id}`))));

      let resultsSection = null;
      if (result !== null) {
        if (groups.length > 0) {
          const groupNodes = groups.map((group) => {
            const title = titleFor(group.sessionId);
            const isCurrent = group.sessionId === currentId;
            const isSelected = selected !== null && selected.sessionId === group.sessionId;
            const head = h('button', {
              type: 'button',
              className: isSelected ? 'dsh-ch-groupHead dsh-ch-rowSelected' : 'dsh-ch-groupHead',
              'aria-label': isCurrent ? t('hit.openCurrent', { title }) : t('hit.open', { title }),
              onClick: () => select(group.sessionId, displayQuery, group.items[0] === undefined ? '' : group.items[0].snippet, 'message', group.items[0] === undefined ? 0 : group.items[0].seq),
            },
            h('span', { className: 'dsh-ch-rowIcon', 'aria-hidden': 'true' }, h(BubbleIcon, {})),
            h('span', { className: 'dsh-ch-groupTitle' }, highlight(title, displayQuery)),
            h('span', { className: 'dsh-ch-kind' }, t('search.sessionKind')),
            isCurrent ? h('span', { className: 'dsh-ch-badge' }, t('current.badge')) : null,
            group.items.length > 1 ? h('span', { className: 'dsh-ch-groupCount', 'aria-hidden': 'true' }, t('search.groupCount', { count: group.items.length })) : null);
            const hits = group.items.map((item, index) => {
              const hitSelected = isSelected;
              const snippet = stripInjectedBlocks(item.snippet);
              const hit = h('button', {
                type: 'button',
                className: hitSelected ? 'dsh-ch-hit dsh-ch-hitSelected' : 'dsh-ch-hit',
                'aria-label': t('hit.open', { title }),
                'aria-pressed': hitSelected ? 'true' : undefined,
                onClick: () => select(group.sessionId, displayQuery, item.snippet, 'message', item.seq),
              }, h('p', { className: 'dsh-ch-snippet' }, highlight(snippet, displayQuery)));
              return h('li', { key: `${group.sessionId}-${index}` }, hit);
            });
            return h('section', { key: group.sessionId, className: 'dsh-ch-group', 'aria-label': title },
              head,
              h('ul', { className: 'dsh-ch-list' }, hits));
          });
          resultsSection = h('section', { className: 'dsh-ch-section', 'aria-label': t('search.messageMatches') },
            h('div', { className: 'dsh-ch-sectionHead' }, t('search.messageMatches')),
            groupNodes);
        } else if (!searching) {
          resultsSection = h('div', { className: 'dsh-ch-empty' },
            h('span', { className: 'dsh-ch-emptyIcon' }, h(HistoryIcon, {})),
            h('h3', { className: 'dsh-ch-emptyTitle' }, result.hostUnavailable === true ? t('search.hostRequired') : t('search.emptyFor', { query: displayQuery })));
        } else {
          resultsSection = h('div', { className: 'dsh-ch-loading' },
            h('span', { className: 'dsh-ch-spinner', 'aria-hidden': 'true' }),
            h('span', {}, t('search.searching')));
        }
      } else if (raw === '') {
        resultsSection = h('section', { className: 'dsh-ch-section', 'aria-label': t('recent.title') },
          h('div', { className: 'dsh-ch-sectionHead' }, t('recent.title')),
          h('p', { className: 'dsh-ch-hint' }, t('recent.hint')),
          recents.length === 0
            ? h('p', { className: 'dsh-ch-hint' }, t('recent.empty'))
            : h('ul', { className: 'dsh-ch-list' }, recents.map((row) => conversationRow(row, row.id))));
      } else if (searching) {
        resultsSection = h('div', { className: 'dsh-ch-loading' },
          h('span', { className: 'dsh-ch-spinner', 'aria-hidden': 'true' }),
          h('span', {}, t('search.searching')));
      } else if (queryLength(raw) < MIN_QUERY_LENGTH) {
        resultsSection = h('div', { className: 'dsh-ch-empty' },
          h('span', { className: 'dsh-ch-emptyIcon' }, h(HistoryIcon, {})),
          h('h3', { className: 'dsh-ch-emptyTitle' }, t('search.minLength')));
      } else {
        resultsSection = h('div', { className: 'dsh-ch-empty' },
          h('span', { className: 'dsh-ch-emptyIcon' }, h(HistoryIcon, {})),
          h('h3', { className: 'dsh-ch-emptyTitle' }, t('search.label')));
      }

      const listBody = statusError
        ? h('div', { className: 'dsh-ch-empty', role: 'alert' },
          h('span', { className: 'dsh-ch-emptyIcon' }, h(HistoryIcon, {})),
          h('h3', { className: 'dsh-ch-emptyTitle' }, t('search.label')),
          h('p', { className: 'dsh-ch-emptyText' }, t('search.failed', { message: errorMessage })))
        : h(React.Fragment, null, titleSection, resultsSection);

      const matchModel = React.useMemo(() => {
        if (context.kind !== 'ready' || selected === null) return { entries: EMPTY_ITEMS };
        const needle = selected.query.toLocaleLowerCase();
        if (needle === '') return { entries: EMPTY_ITEMS };
        const rows = Array.isArray(context.rows) ? context.rows : EMPTY_ITEMS;
        const entries = [];
        for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
          const row = rows[rowIndex];
          const raw = stripInjectedBlocks(typeof row.text === 'string' ? row.text : '');
          if (row.role === 'user' && isCodeDominated(raw)) continue;
          const expanded = expandedRows.has(`ctx-${row.seq}-${rowIndex}`) || (row.seq === context.anchorSeq && matchRanges(raw, selected.query).some(range => range.end > CONTEXT_MESSAGE_CHARS));
          const text = !expanded && raw.length > CONTEXT_MESSAGE_CHARS ? raw.slice(0, CONTEXT_MESSAGE_CHARS) : raw;
          const ranges = matchRanges(text, selected.query);
          for (let occurrence = 0; occurrence < ranges.length; occurrence += 1) {
            entries.push({ rowIndex, occurrence });
          }
        }
        return { entries };
      }, [context, selected, expandedRows]);

      const matchCount = matchModel.entries.length;
      const activeMatchIndex = matchCount === 0 ? 0 : Math.min(currentMatch, matchCount - 1);
      const activeEntry = matchCount === 0 ? null : matchModel.entries[activeMatchIndex];

      const moveMatch = (delta) => {
        if (matchCount === 0) return;
        setCurrentMatch((current) => {
          const base = Math.min(current, matchCount - 1);
          return (base + delta + matchCount) % matchCount;
        });
        setExpand(0);
      };

      const visibleContext = React.useMemo(() => {
        if (context.kind !== 'ready') return null;
        const rows = Array.isArray(context.rows) ? context.rows : EMPTY_ITEMS;
        let anchorIndex = -1;
        if (activeEntry === null && typeof context.anchorSeq === 'number' && context.anchorSeq > 0) {
          for (let index = 0; index < rows.length; index += 1) {
            if (rows[index].seq >= context.anchorSeq) {
              anchorIndex = index;
              break;
            }
          }
          if (anchorIndex < 0 && rows.length > 0) anchorIndex = rows.length - 1;
        }
        const focusIndex = activeEntry === null ? anchorIndex : activeEntry.rowIndex;
        const total = rows.length;
        let start;
        let end;
        if (focusIndex >= 0) {
          start = Math.max(0, focusIndex - (30 + expand * 30));
          end = Math.min(total, focusIndex + (60 + expand * 60));
        } else {
          start = Math.max(0, total - (80 + expand * 60));
          end = total;
        }
        return {
          rows: rows.slice(start, end),
          start,
          focusRow: focusIndex,
          hasMore: start > 0 || end < total,
          total,
        };
      }, [context, activeEntry, expand]);

      const listPane = h('div', {
        className: selected === null ? 'dsh-ch-listPane' : 'dsh-ch-listPane dsh-ch-listPaneDocked',
      }, h('div', { className: 'dsh-ch-content' }, listBody));

      let detailPane = null;
      if (selected !== null) {
        let detailBody;
        if (context.kind === 'loading') {
          detailBody = h('div', { className: 'dsh-ch-loading' },
            h('span', { className: 'dsh-ch-spinner', 'aria-hidden': 'true' }),
            h('span', {}, t('context.loading')));
        } else if (context.kind === 'error') {
          detailBody = h('p', { className: 'dsh-ch-detailHint', role: 'alert' }, t('context.failed', { message: context.message }));
        } else if (context.kind === 'ready' && visibleContext !== null) {
          const parts = [];
          if (selected.kind === 'session' && selected.query !== '') {
            parts.push(h('p', { className: 'dsh-ch-detailHint' }, t('context.titleHit')));
          }
          const showNotFound = selected.kind !== 'session' && selected.query !== '' && context.found !== true;
          if (showNotFound) {
            parts.push(h('p', { className: 'dsh-ch-detailHint' }, t('context.notFound')));
            if (context.hasMore === true) {
              parts.push(h('button', {
                type: 'button',
                className: 'dsh-ch-contextMore',
                onClick: () => setSeekPages((current) => current + CONTEXT_SEEK_STEP),
              }, t('context.seekMore')));
            }
          }
          if (visibleContext.total === 0 && showNotFound === false) parts.push(h('p', { className: 'dsh-ch-detailHint' }, t('context.empty')));
          visibleContext.rows.forEach((row, index) => {
            parts.push(contextRowNode(row, index));
          });
          if (visibleContext.hasMore) {
            parts.push(h('button', {
              type: 'button',
              className: 'dsh-ch-contextMore',
              onClick: () => setExpand((current) => current + 1),
            }, t('context.loadMore')));
          }
          detailBody = h(React.Fragment, null, ...parts);
        } else {
          detailBody = h('p', { className: 'dsh-ch-detailHint' }, t('context.hint'));
        }
        detailPane = h('aside', { className: 'dsh-ch-detailPane', 'aria-label': t('context.title') },
          h('div', { className: 'dsh-ch-detailHeader' },
            h('span', { className: 'dsh-ch-detailTitle' }, titleFor(selected.sessionId)),
            h('button', {
              type: 'button',
              className: 'dsh-ch-detailAction',
              onClick: () => open(selected.sessionId),
            }, t('context.open')),
            h('button', {
              type: 'button',
              className: 'dsh-ch-detailAction',
              'aria-label': t('context.close'),
              title: t('context.close'),
              onClick: () => setSelected(null),
            }, '×')),
          h('div', { ref: paneRef, className: 'dsh-ch-detailScroll' }, detailBody));
      }

      const statusClassName = statusError
        ? 'dsh-ch-status dsh-ch-statusError'
        : searching
          ? 'dsh-ch-status dsh-ch-statusBusy'
          : 'dsh-ch-status';

      return h('div', {
        className: 'dsh-ch-root',
        'data-conversation-composer-overlay': '',
        role: 'region',
        'aria-label': t('title'),
      },
      h('div', { className: 'dsh-ch-header' },
        h('div', { className: 'dsh-ch-headerInner' },
          h('div', { className: 'dsh-ch-titleRow' },
            h('div', {},
              h('h2', { className: 'dsh-ch-title' }, t('title')),
              h('p', { className: 'dsh-ch-subtitle' }, t('subtitle')))),
          h('div', { className: 'dsh-ch-search' },
            h('span', { className: 'dsh-ch-searchIcon', 'aria-hidden': 'true' }, h(SearchIcon, {})),
            h('input', {
              ref: inputRef,
              type: 'search',
              className: 'dsh-ch-input',
              value: query,
              placeholder: t('search.placeholder'),
              'aria-label': t('search.label'),
              spellCheck: false,
              autoComplete: 'off',
              onChange: (event) => setQuery(event.target.value),
              onKeyDown: onInputKeyDown,
            }),
            query === '' ? null : h('button', {
              type: 'button',
              className: 'dsh-ch-clear',
              'aria-label': t('search.clear'),
              title: t('search.clear'),
              onClick: () => {
                setQuery('');
                const node = inputRef.current;
                if (node !== null && typeof node.focus === 'function') node.focus();
              },
            }, h(ClearIcon, {}))),
            query === '' || selected === null || result === null || normalizeQueryKey(result.query) !== normalizeQueryKey(raw) || matchCount === 0 ? null : h('div', { className: 'dsh-ch-nav' },
              h('button', {
                type: 'button',
                className: 'dsh-ch-navButton',
                'aria-label': t('search.prevMatch'),
                title: t('search.prevMatch'),
                disabled: matchCount === 0,
                onClick: () => moveMatch(-1),
              }, h(ChevronLeftIcon, {})),
              h('span', { className: 'dsh-ch-navCount', 'aria-live': 'polite' },
                `${matchCount === 0 ? 0 : activeMatchIndex + 1}/${matchCount}`),
              h('button', {
                type: 'button',
                className: 'dsh-ch-navButton',
                'aria-label': t('search.nextMatch'),
                title: t('search.nextMatch'),
                disabled: matchCount === 0,
                onClick: () => moveMatch(1),
              }, h(ChevronRightIcon, {}))),
          h('div', {
            className: statusClassName,
            role: 'status',
            'aria-live': 'polite',
          }, searching ? h('span', { className: 'dsh-ch-dot', 'aria-hidden': 'true' }) : null, statusText))),
      h('div', { className: 'dsh-ch-body' }, listPane, detailPane));
    }
    //#endregion

    return {
      inject: ['slots', 'locale', 'sessions', 'uiWorkspace'],
      /**
       * Register this bundle's dictionaries, stylesheet, and the `history`
       * Conversation View. Everything is an effect owned by the Client run.
       * @param ctx - Client context with the slots, locale, sessions, and uiWorkspace services.
       */
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'conversation-history: dictionaries');
        ctx.effect(() => insertStyles(), 'conversation-history: styles');
        const t = ctx.locale.bind(NS);
        /**
         * Search dialogue-only results through the bundle's Host half, which
         * filters the index to user/assistant events and drops injected
         * boilerplate. Returns null so the view falls back to the shipped
         * Client search when the Host half is unavailable.
         * @param query - literal phrase.
         * @param signal - cancellation for a superseded search.
         * @returns `{ items, hasMore }` or null.
         */
        const searchViaHost = async (query, signal, generation) => {
          const connection = ctx.get('connection');
          if (connection === undefined || connection === null) return null;
          const rpc = connection.rpc;
          if (rpc === undefined || rpc === null || typeof rpc.call !== 'function') return null;
          let result;
          try {
            result = await rpc.call(HOST_CHANNEL, 'conversation-history/search', { query, limit: SEARCH_HOST_LIMIT, ...(generation === undefined ? {} : {generation}) }, signal);
          } catch (error) {
            if (signal !== undefined && signal !== null && signal.aborted) return null;
            console.warn('[conversation-history] host search failed; falling back to the shipped search:', error);
            return null;
          }
          if (result === null || typeof result !== 'object' || result.ok !== true) return null;
          const value = result.value;
          if (value === null || typeof value !== 'object' || !Array.isArray(value.items)) return null;
          const items = [];
          for (const item of value.items) {
            if (item === null || typeof item !== 'object') continue;
            if (typeof item.sessionId !== 'string' || typeof item.snippet !== 'string') continue;
            items.push({ sessionId: item.sessionId, snippet: item.snippet, seq: item.seq, type: item.type });
          }
          // Only a Host that reports prose verification is trusted as-is; an
          // older Host is filtered locally like the page-walk fallback.
          return { items, hasMore: value.hasMore === true, proseFiltered: value.proseFiltered === true, indexing: value.indexing === true, generation: value.generation, progress: value.progress, failed: value.failed || 0 };
        };

        const searchHistory = async (query, signal, generation) => {
          const viaHost = await searchViaHost(query, signal, generation);
          if (viaHost !== null) return { ok: true, value: viaHost, hosted: viaHost.proseFiltered === true };
          // No unfiltered fallback: the shipped search would surface tool,
          // injected, and code text. Report the missing Host filter instead.
          return { ok: true, value: { items: [], hasMore: false }, hosted: false, hostUnavailable: true };
        };
        const openConversation = (id) => {
          ctx.uiWorkspace.openSession(id);
        };

        /**
         * Ask the bundle's Host half for a precise dialogue window around the
         * matched event. Available when the Host half is loaded; returns null
         * otherwise so the Client can fall back to walking history pages.
         * @param targetSessionId - session whose message matched.
         * @param query - the search phrase.
         * @param snippet - the host-provided hit snippet, used to identify the event.
         * @returns rows/anchor from the Host, or null to use the page fallback.
         */
        const locateViaHost = async (targetSessionId, query, snippet, seq) => {
          const connection = ctx.get('connection');
          if (connection === undefined || connection === null) return null;
          const rpc = connection.rpc;
          if (rpc === undefined || rpc === null || typeof rpc.call !== 'function') return null;
          let result;
          try {
            result = await rpc.call(HOST_CHANNEL, 'conversation-history/locate', {
              sessionId: targetSessionId,
              query: typeof query === 'string' ? query : '',
              snippet: typeof snippet === 'string' ? snippet : '',
              seq: typeof seq === 'number' ? seq : 0,
            });
          } catch (error) {
            console.warn('[conversation-history] host locate failed; falling back to history pages:', error);
            return null;
          }
          if (result === null || typeof result !== 'object' || result.ok !== true) return null;
          const value = result.value;
          if (value === null || typeof value !== 'object' || !Array.isArray(value.rows)) return null;
          const rows = [];
          for (const row of value.rows) {
            if (row === null || typeof row !== 'object') continue;
            if (typeof row.role !== 'string' || typeof row.text !== 'string') continue;
            rows.push({
              seq: typeof row.seq === 'number' ? row.seq : 0,
              time: typeof row.time === 'number' ? row.time : 0,
              role: row.role,
              text: row.text,
            });
          }
          return {
            rows,
            hasMore: false,
            found: value.found === true,
            anchorSeq: typeof value.anchorSeq === 'number' ? value.anchorSeq : 0,
          };
        };

        /**
         * Read one session's loaded transcript rows for the in-view context pane.
         * Retaining the session opens its history window without switching the
         * UI; older pages are fetched only while the clicked passage is missing.
         * @param targetSessionId - session whose messages are read.
         * @param query - phrase to locate in the loaded window.
         * @param maxPages - extra older pages to scan after the tail page.
         * @returns rows, whether older history remains, and whether the phrase was found.
         */
        const loadSessionContext = async (targetSessionId, query, maxPages, snippet, options) => {
          const kind = options !== null && typeof options === 'object' && options.kind === 'session' ? 'session' : 'message';
          const seq = options !== null && typeof options === 'object' && typeof options.seq === 'number' ? options.seq : 0;
          // A conversation title/session selection shows its recent messages; it
          // is not a phrase search, so it must not report "phrase not found".
          const located = kind === 'message' ? await locateViaHost(targetSessionId, query, snippet, seq) : null;
          // The Host prose gate is authoritative: a found:false answer must not
          // fall back to page walking, which could anchor on non-prose text.
          if (located !== null) return located;
          const limit = typeof maxPages === 'number' && maxPages >= 0 ? maxPages : CONTEXT_SEEK_PAGES;
          const reference = ctx.sessions.retain(targetSessionId, { source: 'historyPreview' });
          try {
            await reference.ready;
            const binding = reference.binding;
            const read = () => {
              const window = binding.eventSource.getSnapshot();
              const events = [];
              for (const entry of window.entries) {
                if (entry !== null && typeof entry === 'object' && entry.type === 'event') events.push(entry.event);
              }
              return { events, hasMore: window.hasMore === true };
            };
            const needle = typeof query === 'string' ? query.trim().toLocaleLowerCase() : '';
            const probe = typeof snippet === 'string'
              ? stripInjectedBlocks(snippet).replace(/…/g, ' ').replace(/\s+/g, ' ').trim().toLocaleLowerCase().slice(0, 40)
              : '';
            const scanned = new globalThis.Set();
            const matchesText = (text) => {
              const lower = text.toLocaleLowerCase();
              if (needle !== '' && lower.includes(needle)) return true;
              if (probe.length >= 6 && lower.includes(probe)) return true;
              return false;
            };
            const scan = (events) => {
              for (const event of events) {
                const seq = typeof event.seq === 'number' ? event.seq : -1;
                if (seq >= 0) {
                  if (scanned.has(seq)) continue;
                  scanned.add(seq);
                }
                if (matchesText(eventTextAny(event))) return event;
              }
              return undefined;
            };
            let state = read();
            let match = kind === 'message' ? scan(state.events) : undefined;
            let pages = 0;
            while (kind === 'message' && match === undefined && (needle !== '' || probe !== '') && state.hasMore && pages < limit) {
              await binding.session.loadOlder();
              state = read();
              match = scan(state.events);
              pages += 1;
            }
            return {
              rows: contextRowsOf(state.events),
              hasMore: state.hasMore,
              found: kind === 'message' ? needle === '' || match !== undefined : false,
              anchorSeq: match !== undefined && typeof match.seq === 'number' ? match.seq : 0,
            };
          } finally {
            reference.release();
          }
        };
        ctx.slots.inject('conversation.view', () => ctx.slots.register({
          name: 'conversation.view',
          id: 'history',
          order: 20,
          locale: NS,
          label: () => t('view.history'),
          inject: () => ({ searchHistory, openConversation, loadSessionContext }),
        }, ConversationHistoryView));
      },
    };
  },
});
