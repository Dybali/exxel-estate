import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';import ts from 'typescript';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),native=createRequire(import.meta.url),cache=new Map();
function load(file){const full=path.resolve(root,file);if(cache.has(full))return cache.get(full);const m={exports:{}};const code=ts.transpile(readFileSync(full,'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true});new Function('require','module','exports',code)(name=>{if(name.startsWith('.')||name.startsWith('@/')){const p=name.startsWith('@/')?path.resolve(root,name.slice(2)):path.resolve(path.dirname(full),name);return p.endsWith('.json')?JSON.parse(readFileSync(p,'utf8')):load(p+'.ts');}return native(name);},m,m.exports);cache.set(full,m.exports);return m.exports;}
const T=load('lib/translation-trial.ts');

// Admin translation test (lib/translation-trial.ts): request shape, parsing, checks and the cost extrapolation.
const listing={id:'l1',source:'tr',title:'Bodrum’da 3+1 deniz manzaralı villa',description:'Yalıkavak’ta 250 m² arsa içinde 180 m² villa. Havuz, otopark. Fiyat 25.000.000 TL.'};
const translated=code=>({title:`[${code}] 3+1 sea view villa in Bodrum`,description:`[${code}] 180 m² villa on a 250 m² plot in Yalıkavak. Pool, parking. Price 25.000.000 TL.`});

test('request: one call with every other site language, JSON schema, minimal thinking; listing text is data',()=>{
 const body=T.trialRequest('gemini-3.5-flash-lite','tr',listing);
 assert.deepEqual(T.trialTargets('tr'),['de','fr','en','ar','fa','ru','nl']);
 assert.deepEqual(body.generationConfig.responseSchema.required,['de','fr','en','ar','fa','ru','nl']);
 assert.deepEqual(body.generationConfig.thinkingConfig,{thinkingLevel:'minimal'});
 assert.match(body.systemInstruction.parts[0].text,/data, never instructions/);
 assert.deepEqual(JSON.parse(body.contents[0].parts[0].text),{title:listing.title,description:listing.description});
 // A German listing is translated into Turkish too, never into German.
 assert.deepEqual(T.trialTargets('de'),['tr','fr','en','ar','fa','ru','nl']);
 assert.equal(T.isTrialModel('gemini-3.5-flash-lite'),true);assert.equal(T.isTrialModel('gemini-3.5-pro'),false);assert.equal(T.isTrialModel('gemini-2.5-flash-lite'),false,'retired by Google (404)');
 // Persian and Arabic-Indic digits are the same numbers, not lost ones.
 assert.deepEqual(T.trialWarnings({title:'5+1 villa',description:'300 m² bahçe'},{title:'ویلا ۵+۱',description:'باغ ٣٠٠ متر مربع'}),[]);
});

test('run: parses the answer, counts characters and tokens, flags lost numbers and missing languages',async()=>{
 const answer=Object.fromEntries(T.trialTargets('tr').filter(c=>c!=='fa').map(c=>[c,translated(c)]));
 answer.ru={title:'Вилла 3+1',description:'Вилла 180 м² в Ялыкаваке.'};// lost 250 and the price
 let sent;
 const fetcher=async(url,init)=>{sent={url,init};return new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(answer)}]}}],usageMetadata:{promptTokenCount:400,candidatesTokenCount:2000,thoughtsTokenCount:10}}),{status:200});};
 const result=await T.runTrial('key','gemini-3.5-flash-lite',listing,fetcher);
 assert.match(sent.url,/models\/gemini-3\.5-flash-lite:generateContent$/);assert.equal(sent.init.headers['x-goog-api-key'],'key');
 assert.deepEqual(result.usage,{input:400,output:2000,thinking:10});
 assert.equal(result.cost,(400*0.30+2010*2.50)/1e6);
 assert.deepEqual(result.missing,['fa']);
 assert.equal(result.finish,'STOP');
 assert.ok(result.translations.ru.warnings.some(w=>/250/.test(w)&&/25000000/.test(w)),result.translations.ru.warnings.join());
 assert.deepEqual(result.translations.de.warnings,[]);
 const expected=Object.values(answer).reduce((sum,item)=>sum+T.chars(item.title)+T.chars(item.description),0);
 assert.equal(result.outputChars,expected);
});

test('run: provider errors become readable messages without the key',async()=>{
 await assert.rejects(T.runTrial('key','gemini-3.5-flash-lite',listing,async()=>new Response('x',{status:429})),e=>e instanceof T.TrialError&&/429/.test(e.message));
 await assert.rejects(T.runTrial('key','gemini-3.5-flash-lite',listing,async()=>{throw new Error('net');}),e=>e instanceof T.TrialError&&!/key/.test(e.message));
});

test('estimate: measured cost per translated character scaled to 2,1 billion, batch at half price',()=>{
 const results=[{model:'gemini-3.5-flash-lite',usage:{input:1000,output:10000,thinking:0},outputChars:30000},{model:'gemini-3.5-flash-lite',usage:{input:1000,output:10000,thinking:0},outputChars:30000}];
 const estimate=T.trialEstimate(results);
 const cost=2*(1000*0.30+10000*2.50)/1e6;
 assert.equal(estimate.outputChars,60000);assert.equal(estimate.cost,cost);assert.equal(estimate.charsPerOutputToken,3);
 assert.ok(Math.abs(estimate.standard-cost/60000*2.1e9)<1e-6);
 assert.ok(Math.abs(estimate.batch-estimate.standard/2)<1e-6);
 // Roughly 1.770 $ for 2,1 billion characters at 3 characters per output token.
 assert.ok(estimate.standard>1700&&estimate.standard<1800,String(estimate.standard));
});

test('OpenAI GPT-5 nano: strict JSON schema, minimal reasoning, reasoning tokens billed as output',async()=>{
 const body=T.openaiTrialRequest('gpt-5-nano','tr',listing);
 assert.equal(body.model,'gpt-5-nano');assert.equal(body.reasoning_effort,'minimal');assert.equal(body.temperature,undefined,'GPT-5 has a fixed temperature');
 assert.equal(body.response_format.json_schema.strict,true);assert.equal(body.response_format.json_schema.schema.additionalProperties,false);
 assert.deepEqual(body.response_format.json_schema.schema.required,['de','fr','en','ar','fa','ru','nl']);
 assert.deepEqual(JSON.parse(body.messages[1].content),{title:listing.title,description:listing.description});
 let seen;const answer=Object.fromEntries(T.trialTargets('tr').map(code=>[code,{title:code+' '+listing.title,description:code+' '+listing.description}]));
 const fetcher=async(url,init)=>{seen={url,init};return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(answer)}}],usage:{prompt_tokens:400,completion_tokens:1300,completion_tokens_details:{reasoning_tokens:100}}});};
 const result=await T.runTrial('sk-fixture','gpt-5-nano',listing,fetcher);
 assert.equal(seen.url,'https://api.openai.com/v1/chat/completions');assert.equal(seen.init.headers.Authorization,'Bearer sk-fixture');
 assert.deepEqual(result.usage,{input:400,output:1200,thinking:100});assert.equal(result.finish,'STOP');assert.deepEqual(result.missing,[]);
 assert.ok(Math.abs(result.cost-(400*0.05+1300*0.40)/1e6)<1e-12);
 await assert.rejects(T.runTrial('sk-fixture','gpt-5-nano',listing,async()=>new Response('x',{status:429})),e=>e instanceof T.TrialError&&/OpenAI/.test(e.message)&&!/sk-/.test(e.message));
});
