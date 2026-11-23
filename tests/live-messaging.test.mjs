// Live messaging (lib/live-events.ts, app/api/live/route.ts, lib/live-client.ts, 2026-11-23).
import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import ts from 'typescript';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const load=p=>import('data:text/javascript;base64,'+Buffer.from(ts.transpile(read(p),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022})).toString('base64'));
const live=await load('lib/live-events.ts');

test('events reach only the addressed account, every open stream of it, until it stops listening',()=>{
 const a=[],a2=[],b=[];const stopA=live.subscribe('a',e=>a.push(e)),stopA2=live.subscribe('a',e=>a2.push(e)),stopB=live.subscribe('b',e=>b.push(e));
 const event={type:'message',listingId:'l1',peerId:'b'};
 assert.equal(live.publish(['a'],event),2);assert.deepEqual(a,[event]);assert.deepEqual(a2,[event]);assert.deepEqual(b,[]);
 stopA();assert.equal(live.publish(['a','a'],event),1);assert.equal(a.length,1);assert.equal(a2.length,2);
 stopA2();stopB();assert.equal(live.openStreams('a'),0);assert.equal(live.publish(['a'],event),0);
});
test('a ninth stream of the same account closes the oldest one',()=>{
 const evicted=[];const stops=[];for(let i=0;i<live.MAX_STREAMS_PER_USER;i++)stops.push(live.subscribe('c',()=>{},()=>evicted.push(i)));
 stops.push(live.subscribe('c',()=>{},()=>evicted.push('new')));
 assert.deepEqual(evicted,[0]);assert.equal(live.openStreams('c'),live.MAX_STREAMS_PER_USER);for(const s of stops)s();
});
test('typing signals are rate limited per sender and thread',()=>{
 assert.equal(live.typingAllowed('u','l','p',1000),true);assert.equal(live.typingAllowed('u','l','p',2000),false);
 assert.equal(live.typingAllowed('u','l','other',2000),true);assert.equal(live.typingAllowed('u','l','p',1000+live.TYPING_INTERVAL_MS),true);
 assert.equal(live.sseFrame('read',{type:'read'}),'event: read\ndata: {"type":"read"}\n\n');
});
test('wiring: messages API publishes ids only, stream is unbuffered, pages fall back to polling',()=>{
 const route=read('app/api/messages/route.ts');assert.match(route,/publish\(\[String\(result\.peerId\)\], \{ type: "message"/);assert.match(route,/type: "read"/);assert.doesNotMatch(route,/publish\([^)]*body/);
 const stream=read('app/api/live/route.ts');assert.match(stream,/"X-Accel-Buffering": "no"/);assert.match(stream,/text\/event-stream/);assert.match(stream,/if \(!user\) return error\("Giriş gerekli\.", 401\)/);
 assert.match(stream,/SELECT id FROM messages WHERE listing_id=\?/);
 const inbox=read('components/MessagesInbox.tsx');assert.match(inbox,/live \? 60000 : 15000/);assert.match(inbox,/live \? 90000 : 20000/);assert.match(inbox,/sendTyping\(/);
 assert.match(read('components/Header.tsx'),/useLiveEvents\(Boolean\(user\?\.id\)/);
});
