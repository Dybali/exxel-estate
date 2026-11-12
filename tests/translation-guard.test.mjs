import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import ts from 'typescript';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const m={exports:{}};new Function('module','exports',ts.transpile(readFileSync(path.join(root,'lib/translation-guard.ts'),'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}))(m,m.exports);
const {translationRequestAllowed}=m.exports;
const browser={'sec-fetch-site':'same-origin','sec-fetch-mode':'cors','accept-language':'tr-TR,tr;q=0.9'};
const check=(agent,extra={})=>translationRequestAllowed(new Headers({...browser,'user-agent':agent,...extra}));

// Bot protection for paid translations (lib/translation-guard.ts).
test('real browsers and in-app browsers of social apps may start a translation',()=>{
 for(const agent of [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.6; rv:133.0) Gecko/20100101 Firefox/133.0',
  'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36 Instagram 350.0.0.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [LinkedInApp]',
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36 DuckDuckGo/5',
 ])assert.deepEqual(check(agent),{allowed:true},agent);
});
test('crawlers, previews, scripts and headless browsers are refused',()=>{
 for(const agent of [
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0 Safari/537.36',
  'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36 (compatible; Google-InspectionTool/1.0)',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.0.0 Safari/537.36',
  'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)',
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  'WhatsApp/2.24.1 A','TelegramBot (like TwitterBot)','python-requests/2.32.3','curl/8.7.1','node-fetch/1.0','axios/1.7.7','Go-http-client/2.0','',
 ])assert.equal(check(agent).allowed,false,agent);
});
test('a browser user agent without browser fetch metadata is a script',()=>{
 const chrome='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
 assert.deepEqual(check(chrome,{'sec-fetch-site':''}),{allowed:false,reason:'not_browser'});
 assert.deepEqual(check(chrome,{'sec-fetch-site':'cross-site'}),{allowed:false,reason:'not_browser'});
 assert.deepEqual(check(chrome,{'sec-fetch-mode':'navigate'}),{allowed:false,reason:'not_browser'});
 assert.deepEqual(check(chrome,{'accept-language':''}),{allowed:false,reason:'not_browser'});
});
