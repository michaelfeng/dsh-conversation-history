import { readFile, writeFile, mkdir } from 'node:fs/promises';
import vm from 'node:vm';

// Static previews of the real History component. All content below is fictional.
const base = new URL('../', import.meta.url);
const source = await readFile(new URL('client.js', base), 'utf8');
const stamp = Date.UTC(2026, 0, 15, 9);
const scenarios = {
  en: {
    query: 'release', title: 'Find the conversation. Keep the context.',
    subtitle: 'Conversation History for DeepSeek Harness',
    titles: ['Release checklist', 'Documentation refresh', 'Weekend reading list'],
    snippets: ['Before the release, review the getting-started guide and confirm the examples run offline.', 'The release notes should explain what changed and link to the migration guide.', 'A short reading list for the weekend.'],
    rows: [
      {seq: 3, role: 'user', text: 'What should we check before the release?'},
      {seq: 4, role: 'assistant', text: '## Release checklist\n\nBefore the release, review these three items:\n\n- Check the getting-started guide.\n- Run the examples with sample data.\n- Confirm the migration notes are clear.\n\n**Keep the first release small.** Ship the essentials, then improve them from feedback.'},
      {seq: 5, role: 'user', text: 'Let’s finish the documentation first.'},
    ],
    caption: 'Actual component · Fictional conversations · Static preview',
  },
  zh: {
    query: '发布', title: '找到聊过的内容，也看得到上下文。',
    subtitle: 'DeepSeek Harness 聊天记录搜索插件',
    titles: ['示例项目发布清单', '文档更新计划', '周末阅读计划'],
    snippets: ['发布前先检查入门文档，再确认示例可以离线运行。', '这次发布说明需要列出变化，并附上迁移指南。', '整理一份适合周末阅读的文章清单。'],
    rows: [
      {seq: 3, role: 'user', text: '发布前还需要检查哪些内容？'},
      {seq: 4, role: 'assistant', text: '## 发布检查清单\n\n这次发布前，先完成三件事：\n\n- 检查入门文档是否容易理解。\n- 使用示例数据运行一遍完整流程。\n- 补充升级方式和已知限制。\n\n**第一版保持简单。** 先交付核心功能，再根据反馈改进。'},
      {seq: 5, role: 'user', text: '好的，先把文档整理清楚。'},
    ],
    caption: '真实组件渲染 · 全部对话均为虚构示例 · 静态预览',
  },
};
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function html(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (Array.isArray(node)) return node.map(html).join('');
  if (typeof node !== 'object') return escape(node);
  if (typeof node.type === 'function') return html(node.type(node.props));
  if (node.type === 'fragment') return html(node.props.children);
  const attrs = Object.entries(node.props).filter(([k,v])=>!['children','key','ref'].includes(k) && !k.startsWith('on') && v !== undefined && v !== null && v !== false).map(([k,v])=> {
    if(k==='className')k='class';
    if(k==='style')v=Object.entries(v).map(([p,val])=>p.replace(/[A-Z]/g,m=>'-'+m.toLowerCase())+':'+val).join(';');
    k=k.replace(/^(strokeWidth|strokeLinecap|strokeLinejoin|fillRule|clipRule)$/,x=>x.replace(/[A-Z]/g,m=>'-'+m.toLowerCase()));
    return ` ${k}="${escape(v === true ? '' : v)}"`;
  }).join('');
  return `<${node.type}${attrs}>`+(['input','br','hr','img'].includes(node.type)?'':html(node.props.children)+`</${node.type}>`);
}
for (const [language, sample] of Object.entries(scenarios)) {
  let definition, component, dictionaries, cursor=0, css='';
  const items=sample.snippets.slice(0,2).map((snippet,i)=>({sessionId:'sample-'+i,snippet,seq:4}));
  const states={0:sample.query,1:{query:sample.query,items,hosted:true,hasMore:false},2:'idle',5:{sessionId:'sample-0',query:sample.query,snippet:items[0].snippet,seq:4,kind:'message'},6:{kind:'ready',found:true,anchorSeq:4,rows:sample.rows}};
  const React={Fragment:'fragment',createElement:(type,props,...children)=>({type,props:{...props,children}}),useMemo:f=>f(),useEffect:()=>{},useRef:x=>({current:x}),useState:initial=>{const i=cursor++;return [Object.hasOwn(states,i)?states[i]:typeof initial==='function'?initial():initial,()=>{}];}};
  const sandbox={window:{__ModuleLoader__:{load:d=>definition=d}},console,AbortController,setTimeout,clearTimeout,performance,
    document:{head:{appendChild:tag=>css=tag.textContent},createElement:()=>({dataset:{},remove(){}})}};
  vm.runInNewContext(source,sandbox);
  const t=(key,params={})=>Object.entries(params).reduce((s,[k,v])=>s.replaceAll('{'+k+'}',v),dictionaries[language][key]??key);
  definition.factory(()=>React).apply({effect:f=>f(),locale:{register:(ns,value)=>{dictionaries=value;return ()=>{};},bind:()=>t},get:()=>undefined,sessions:{},uiWorkspace:{},slots:{inject:(name,f)=>f(),register:(options,view)=>{component=view;return ()=>{};}}});
  const byId=Object.fromEntries(sample.titles.map((displayTitle,i)=>['sample-'+i,{id:'sample-'+i,displayTitle,updatedAt:stamp,blank:false}]));
  const content=html(component({sessionId:'sample-0',useSessions:f=>f({byId}),t,searchHistory:async()=>{},loadSessionContext:async()=>{},openConversation:()=>{}}));
  const document=`<!doctype html><html lang="${language}"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Conversation History — ${language} demo</title><style>
*{box-sizing:border-box}body{margin:0;padding:32px;background:#edf0f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC',sans-serif;color:#142031}header{max-width:1120px;margin:0 auto 22px}.eyebrow{font-size:12px;letter-spacing:1.3px;font-weight:600;color:#596e8f;margin-bottom:9px}h1{font-size:30px;line-height:1.2;letter-spacing:-.8px;margin:0 0 9px}header p{font-size:14px;margin:0;color:#5d697c}.window{max-width:1120px;margin:auto;border:1px solid #30394b;border-radius:16px;background:#10141c;overflow:hidden;box-shadow:0 16px 40px #23354b24}.chrome{height:44px;padding:0 20px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #2b3445;color:#aab4c7;font-size:12px}.dot{width:8px;height:8px;border-radius:50%;background:#536077}.chrome span:last-child{margin-left:10px}.tabs{height:42px;padding:0 24px;display:flex;align-items:center;gap:24px;border-bottom:1px solid #2b3445;color:#8e9caf;font-size:12px}.active{height:42px;display:flex;align-items:center;border-bottom:2px solid #91adff;color:#bacdff}.preview{height:565px;--dsw-alias-label-primary:#e5eaf3;--dsw-alias-label-secondary:#9aa9bd;--dsw-alias-bg-base:#131923;--dsw-alias-bg-layer-1:#18202d;--dsw-alias-bg-layer-2:#202b3b;--dsw-alias-border-l1:#344056;--dsw-alias-border-l2:#2b3547;--dsw-alias-brand-primary:#aac0ff;--dsw-alias-state-error-primary:#f88989;--dsh-composer-height:0px;font-size:13px}button,input{font-family:inherit}footer{max-width:1120px;margin:13px auto 0;font-size:11px;color:#6b7788;text-align:right}${css}
</style><header><div class="eyebrow">CONVERSATION HISTORY</div><h1>${escape(sample.title)}</h1><p>${escape(sample.subtitle)}</p></header><main class="window"><div class="chrome"><i class="dot"></i><i class="dot"></i><i class="dot"></i><span>Example workspace</span></div><div class="tabs"><span>Chat</span><span>Trajectory</span><span class="active">History</span></div><div class="preview">${content}</div></main><footer>${escape(sample.caption)}</footer></html>`;
  await mkdir(new URL('demo/',base),{recursive:true});
  await writeFile(new URL(`demo/${language}.html`,base),document);
}
console.log('Rendered two static previews from fictional fixtures.');
