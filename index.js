import { DialogueIndex } from './dialogue-index.js';
import { compileQueryPattern, makeSnippet } from './dialogue.js';

const MAX_RESULTS = 100;
const SEARCH_WAIT_MS = 1200;
function failure(code, message) { return { ok: false, error: { code, message, details: {} } }; }

/** A deadline settles even when the underlying service ignores cancellation. */
async function bounded(promise, ms, signal) {
  let timer, onAbort;
  try {
    return await Promise.race([promise, new Promise((resolve, reject) => {
      timer = setTimeout(() => resolve(false), ms);
      onAbort = () => reject(new Error('Request cancelled'));
      if (signal?.aborted) onAbort();
      else signal?.addEventListener('abort', onAbort, { once: true });
    })]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

async function search(index, payload, signal) {
  const started = performance.now();
  const query = typeof payload?.query === 'string' ? payload.query.trim() : '';
  const pattern = compileQueryPattern(query);
  if (!pattern) return {ok:true,value:{items:[],hasMore:false,proseFiltered:true}};
  // A progress poll consumes the build it observed, even if it completed
  // between polls. Starting a new slow reconciliation here would loop forever.
  const completedPoll = Number.isInteger(payload?.generation) && payload.generation > 0
    && payload.generation === index.completedGeneration && index.pending === null;
  const complete = completedPoll || await bounded(index.refresh().then(()=>true), SEARCH_WAIT_MS, signal);
  const wanted = Math.max(1, Math.min(MAX_RESULTS, Number.isFinite(payload?.limit) ? Math.floor(payload.limit) : MAX_RESULTS));
  const items = [];
  for (const [sessionId, entry] of index.entries) {
    signal?.throwIfAborted();
    // Latest matching dialogue in each conversation; all sessions participate.
    for (let i=entry.rows.length-1; i>=0; i--) {
      const row = entry.rows[i], snippet = makeSnippet(row.prose, pattern);
      if (snippet !== null) {
        items.push({sessionId, snippet, seq:row.seq, time:row.time, type:row.role==='user'?'user/message':'assistant/message'});
        break;
      }
    }
  }
  items.sort((a,b)=>b.time-a.time || a.sessionId.localeCompare(b.sessionId));
  return {ok:true,value:{items:items.slice(0,wanted),hasMore:items.length>wanted,proseFiltered:true,
    indexing:!complete, generation:index.generation, progress:{...index.progress}, failed:index.progress.failed,
    totalMatches:items.length, tookMs:Math.round(performance.now()-started)}};
}

async function locate(index, payload, signal) {
  const id = typeof payload?.sessionId === 'string' ? payload.sessionId : '';
  if (!id) return failure('conversation-history/invalid-request','sessionId must be a non-empty string');
  const pattern = compileQueryPattern(payload.query);
  const empty = {ok:true,value:{found:false,rows:[],anchorSeq:0,total:0,matches:0}};
  if (!pattern) return empty;
  const complete = await bounded(index.refresh().then(()=>true), 4000, signal);
  const rows = index.entries.get(id)?.rows;
  if (!rows) {
    if (!complete || index.progress.failed) return failure('conversation-history/index-pending','Conversation is still being indexed; retry shortly.');
    return empty;
  }
  let anchor = rows.findIndex(row=>row.seq===payload.seq && makeSnippet(row.prose,pattern)!==null);
  if (anchor<0) anchor=rows.findIndex(row=>makeSnippet(row.prose,pattern)!==null);
  if (anchor<0) return empty;
  return {ok:true,value:{found:true,rows:rows.slice(Math.max(0,anchor-20),anchor+40).map(({prose,...row})=>row),
    anchorSeq:rows[anchor].seq,total:rows.length,matches:rows.filter(row=>makeSnippet(row.prose,pattern)!==null).length}};
}

export function apply(ctx, config={}) {
  const index = new DialogueIndex(ctx, config.cacheDir);
  const disposers = [];
  const handler = endpoint => async request => {
    let message;
    try {message=await request.json();} catch {return new Response('body is not JSON',{status:400});}
    const valid=message?.type==='client-request' && typeof message.rpcId==='string' && message.rpcId!=='';
    if (!valid) return Response.json({type:'server-response',rpcId:'invalid-request',result:failure('gateway/bad-request','invalid client-request message')},{status:400});
    let result;
    try { result=await (endpoint==='search'?search:locate)(index,message.payload,request.signal); }
    catch(error) {result=failure('conversation-history/query-failed',error.message);}
    return Response.json({type:'server-response',rpcId:message.rpcId,result});
  };
  try {
    for(const endpoint of ['search','locate']) disposers.push(ctx.connection.fetch.register({
      path:'/api/conversation-history/'+endpoint, methods:['POST'],requestBody:'buffered',fetch:handler(endpoint),
    }));
  } catch(error) { for(const dispose of disposers)void dispose();void index.close();throw error; }
  // Start once while the reader is still opening the view. Searches share this
  // work and return bounded progress; they never enqueue parallel rebuilds.
  const warmup=setTimeout(()=>{void index.refresh().catch(()=>{});},50);
  ctx.effect(()=>async()=>{clearTimeout(warmup);for(const dispose of disposers)await dispose();await index.close();},'conversation-history: dispose routes and index');
}
export const inject=['connection'];
