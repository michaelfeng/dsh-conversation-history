import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { apply } from '../index.js';

const event = (seq, text) => ({seq, time: seq, type: 'user/message', data: {source:{kind:'user'}, content:[{type:'text', text}]}});
function harness(logs, cacheDir, listDelay = 0) {
  const routes = new Map(), disposers = [];
  let reads = 0;
  const revisions = new Map(Object.keys(logs).map(id=>[id, '1']));
  const persistence = {
    list: async () => { if (listDelay) await new Promise(resolve=>setTimeout(resolve,listDelay)); return Object.entries(logs).map(([id, events])=>({header:{id, createdAt:1}, revision: revisions.get(id), eventCount: events.length})); },
    open: async id => ({read: async (offset=0)=>{reads++;return {events:logs[id].slice(offset)};}, close:async()=>{}}),
  };
  apply({get:n=>n==='sessionPersistence'?persistence:n==='sessions'?{list:()=>[]}:undefined,
    connection:{fetch:{register:r=>{routes.set(r.path,r);return ()=>{};}}},
    effect:fn=>{const dispose=fn();if(typeof dispose==='function')disposers.push(dispose);},
  }, {cacheDir});
  return {revisions, get reads(){return reads;}, close:async()=>{for(const fn of disposers)await fn();},
    call:async (endpoint,payload)=>{const response=await routes.get('/api/conversation-history/'+endpoint).fetch(new Request('http://localhost/api',{method:'POST',body:JSON.stringify({type:'client-request',rpcId:'t',payload})}));return (await response.json()).result;}};
}

test('complete search indexes dialogue once, includes large/low-ranked sessions, and refreshes changed logs', async()=>{
 const logs=Object.fromEntries(Array.from({length:20},(_,i)=>['s'+i,[event(0,'unique needle '+i)]]));
 const h=harness(logs);
 try {
  const first=await h.call('search',{query:'unique needle',limit:30});
  assert.equal(first.ok,true);
  assert.equal(first.value.items.length,20,'must not silently stop at 8/12 sessions');
  const reads=h.reads;
  const second=await h.call('search',{query:'needle 19',limit:30});
  assert.equal(second.value.items[0].sessionId,'s19');
  assert.equal(h.reads,reads,'warm searches must not read full logs');
  logs.s19.push(event(1,'fresh appended phrase'));h.revisions.set('s19','2');
  const fresh=await h.call('search',{query:'fresh appended phrase'});
  assert.equal(fresh.value.items[0].seq,1,'append must be visible without TTL stale cache');
  delete logs.s0;
  const removed=await h.call('search',{query:'needle 0'});
  assert.equal(removed.value.items.length,0,'deleted sessions must disappear');
 } finally {await h.close();}
});

test('persistent projections survive plugin reload without rereading unchanged logs',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'history-index-'));
 const logs={persisted:[event(0,'durable prose')]};
 let h=harness(logs,dir);
 try {
  assert.equal((await h.call('search',{query:'durable'})).ok,true);
  await h.close();h=harness(logs,dir);
  const result=await h.call('search',{query:'durable'});
  assert.equal(result.value.items.length,1);
  assert.equal(h.reads,0);
 } finally {await h.close();await rm(dir,{recursive:true,force:true});}
});

test('concurrent searches share one build and expose incomplete progress without hiding large sessions',async()=>{
 let release;const gate=new Promise(r=>release=r);
 const h=harness({slow:[event(0,'needle')]});
 // Delay the public storage read without blocking the event loop.
 // Separate harness below exercises the actual shared in-flight refresh.
 await h.close();
 const routes=new Map(),disposers=[];let reads=0;
 apply({get:n=>n==='sessionPersistence'?{
  list:async()=>[{header:{id:'large'},revision:'1',eventCount:1,sizeBytes:100000000}],
  open:async()=>({read:async()=>{reads++;await gate;return {events:[event(0,'needle')]};},close:async()=>{}}),
 }:undefined,connection:{fetch:{register:r=>{routes.set(r.path,r);return ()=>{};}}},effect:f=>disposers.push(f())});
 const search=async()=>{const res=await routes.get('/api/conversation-history/search').fetch(new Request('http://localhost/api',{method:'POST',body:JSON.stringify({type:'client-request',rpcId:'t',payload:{query:'needle'}})}));return (await res.json()).result;};
 try {
  const [a,b]=await Promise.all([search(),search()]);
  assert.equal(a.value.indexing,true);assert.equal(b.value.indexing,true);assert.equal(reads,1);
  release();
  const ready=await search();assert.equal(ready.value.indexing,false);assert.equal(ready.value.items.length,1);
 }finally{release();for(const dispose of disposers)await dispose();}
});

test('changed revision with equal event count rebuilds rather than returning stale text',async()=>{
 const logs={s:[event(0,'old phrase')]},h=harness(logs);
 try {
  await h.call('search',{query:'old phrase'});
  logs.s=[event(0,'replacement phrase')];h.revisions.set('s','replacement');
  assert.equal((await h.call('search',{query:'old phrase'})).value.items.length,0);
  assert.equal((await h.call('search',{query:'replacement phrase'})).value.items.length,1);
 }finally{await h.close();}
});

test('matches beyond the old 12000-character display cap remain locatable and highlighted',async()=>{
 const h=harness({long:[event(0,'plain prose '.repeat(1200)+'tail needle')]});
 try {
  const hit=await h.call('search',{query:'tail needle'});
  assert.equal(hit.value.items.length,1);
  const located=await h.call('locate',{sessionId:'long',query:'tail needle',seq:0});
  assert.equal(located.value.found,true);
  assert.ok(located.value.rows[0].text.includes('tail needle'));
 }finally{await h.close();}
});

test('unresponsive storage is bounded, and plugin disposal cancels the pending build',async()=>{
 const {DialogueIndex}=await import('../dialogue-index.js');
 const index=new DialogueIndex({get:n=>n==='sessionPersistence'?{list:()=>new Promise(()=>{})}:undefined},undefined,20);
 await assert.rejects(index.refresh(),/timed out/);
 const work=index.refresh();await index.close();
 await assert.rejects(work,/Index stopped/);
 assert.equal(index.entries.size,0);
});

// A build that finishes between UI polls must be consumed, not restarted forever.
test('progress polling consumes its completed generation even when metadata is consistently slow',async()=>{
 const h=harness({s:[event(0,'needle')]},undefined,1400);
 try {
  const first=await h.call('search',{query:'needle'});
  assert.equal(first.value.indexing,true);
  await new Promise(resolve=>setTimeout(resolve,800));
  const start=performance.now();
  const second=await h.call('search',{query:'needle',generation:first.value.generation});
  assert.equal(second.value.indexing,false);
  assert.equal(second.value.items.length,1);
  assert.ok(performance.now()-start<300);
 } finally {await h.close();}
});
