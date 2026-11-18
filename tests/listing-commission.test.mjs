// Agent service fee on listings (lib/listing-commission.ts, 2026-11-18).
import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import ts from 'typescript';
const c=await import('data:text/javascript;base64,'+Buffer.from(ts.transpile(readFileSync(new URL('../lib/listing-commission.ts',import.meta.url),'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022})).toString('base64'));

test('form values within the legal limits: sale up to 4 %, rent up to one month',()=>{
 assert.deepEqual(c.commissionFrom({purpose:'satilik',commissionType:'none'}),{type:'none'});
 assert.deepEqual(c.commissionFrom({purpose:'satilik',commissionType:'share',commissionValue:'2'}),{type:'share',value:2});
 assert.deepEqual(c.commissionFrom({purpose:'satilik',commissionType:'share',commissionValue:'2,5'}),{type:'share',value:2.5});
 assert.deepEqual(c.commissionFrom({purpose:'kiralik',commissionType:'share',commissionValue:'0.5'}),{type:'share',value:0.5});
 assert.throws(()=>c.commissionFrom({purpose:'satilik',commissionType:'share',commissionValue:'4.5'}),/%4/);
 assert.throws(()=>c.commissionFrom({purpose:'kiralik',commissionType:'share',commissionValue:'2'}),/bir aylık/);
 assert.throws(()=>c.commissionFrom({purpose:'satilik',commissionType:'share',commissionValue:''}));
 assert.throws(()=>c.commissionFrom({purpose:'satilik',commissionType:'share',commissionValue:'-1'}));
 assert.throws(()=>c.commissionFrom({purpose:'satilik',commissionType:'free'}));
 assert.equal(c.commissionFrom({purpose:'satilik',commissionType:''}),undefined);
 // Daily rentals and business transfers have no field.
 assert.equal(c.commissionFrom({purpose:'gunluk',commissionType:'share',commissionValue:'1'}),undefined);
 assert.equal(c.commissionFrom({purpose:'devren',commissionType:'none'}),undefined);
});

test('an update without the form fields keeps the stored statement; a changed purpose drops it',()=>{
 assert.deepEqual(c.commissionFrom({purpose:'satilik',commission:{type:'share',value:2}}),{type:'share',value:2});
 assert.equal(c.commissionFrom({purpose:'kiralik',commission:{type:'share',value:2}}),undefined);
 assert.equal(c.commissionFrom({purpose:'satilik'}),undefined);
});

test('reading, amount and label',()=>{
 assert.equal(c.listingCommission({commission:{type:'share',value:9}},'satilik'),null);
 assert.equal(c.listingCommission({commission:'x'},'satilik'),null);
 assert.deepEqual(c.listingCommission({commission:{type:'none'}},'kiralik'),{type:'none'});
 assert.equal(c.commissionAmount({type:'share',value:2},5000000,'satilik'),100000);
 assert.equal(c.commissionAmount({type:'share',value:0.5},30000,'kiralik'),15000);
 assert.equal(c.commissionAmount({type:'none'},5000000,'satilik'),null);
 assert.deepEqual(c.commissionLabel({type:'share',value:2},'satilik'),{key:'Alıcı hizmet bedeli: %{n} + KDV',n:2});
 assert.deepEqual(c.commissionLabel({type:'share',value:1},'kiralik'),{key:'Kiracı hizmet bedeli: {n} aylık kira + KDV',n:1});
 assert.deepEqual(c.commissionLabel({type:'none'},'satilik'),{key:'Komisyonsuz'});
 assert.equal(c.commissionLabel(null,'satilik'),null);
});
