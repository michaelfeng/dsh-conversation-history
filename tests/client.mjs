import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function client() {
 let module, registration, effects=[], states=[], cursor=0;
 const timers=new Map();let nextTimer=0;
 const React={createElement:(type,props,...children)=>({type,props:{...props,children}}),useMemo:f=>f(),
  useState:initial=>{const i=cursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return [states[i],v=>{states[i]=typeof v==='function'?v(states[i]):v;}];},
  useEffect:f=>effects.push(f),useRef:x=>({current:x})};
 const context={window:{__ModuleLoader__:{load:x=>module=x}},console,AbortController,Map,Set,performance,
  setTimeout:(f,ms)=>{const id=++nextTimer;timers.set(id,{f,ms});return id;},clearTimeout:id=>timers.delete(id),
  document:{createElement:()=>({dataset:{},remove(){}}),head:{appendChild(){}}}};
 vm.runInNewContext(readFileSync(new URL('../client.js',import.meta.url),'utf8'),context);
 let rpc=async()=>({ok:true,value:{items:[{sessionId:'s',snippet:'test',seq:987,type:'user/message'}],proseFiltered:true}});
 module.factory(()=>React).apply({effect:f=>f(),locale:{register:()=>()=>{},bind:()=>k=>k},
  get:n=>n==='connection'?{rpc:{call:(...args)=>rpc(...args)}}:undefined,sessions:{},uiWorkspace:{},
  slots:{inject:(name,f)=>f(),register:(options,component)=>{registration={options,component};return ()=>{};}}});
 return {states,timers,setRpc:f=>rpc=f,ops:registration.options.inject(),
  render(query){states[0]=query;cursor=0;effects=[];registration.component({sessionId:'s',useSessions:f=>f({byId:{}}),t:k=>k,...registration.options.inject()});return effects[1]();},
  async fire(ms){const entry=[...timers].find(([id,t])=>t.ms===ms);assert.ok(entry,'missing timer '+ms);timers.delete(entry[0]);entry[1].f();for(let i=0;i<20;i++)await Promise.resolve();}};
}

test('host search preserves the exact matched message sequence',async()=>{
 const c=client();assert.equal((await c.ops.searchHistory('test')).value.items[0].seq,987);
});
test('search timeout exits loading even when RPC ignores abort forever',async()=>{
 const c=client();c.setRpc(()=>new Promise(()=>{}));const cleanup=c.render('never resolves');
 await c.fire(300);await c.fire(8000);
 assert.equal(c.states[2],'error');assert.equal(c.states[3],'search.timeout');cleanup();
});

test('partial index results are polled and never become a permanent cached empty result',async()=>{
 const c=client();let calls=0;
 c.setRpc(async()=>{calls++;return {ok:true,value:{items:calls===1?[]:[{sessionId:'s',snippet:'needle',seq:5}],proseFiltered:true,indexing:calls===1,progress:{indexed:calls-1,total:1}}};});
 const cleanup=c.render('needle');await c.fire(300);
 assert.equal(c.states[1].indexing,true);await c.fire(800);
 assert.equal(c.states[1].items[0].seq,5);assert.equal(c.states[1].indexing,false);cleanup();
});
