// Calls to action by account type (lib/account-actions.ts).
import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import ts from 'typescript';
const {viewerActions,viewerOf}=await import('data:text/javascript;base64,'+Buffer.from(ts.transpile(readFileSync(new URL('../lib/account-actions.ts',import.meta.url),'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022})).toString('base64'));

test('each account type sees only what it needs',()=>{
 assert.deepEqual(viewerActions('guest'),{postListing:true,addServiceFirm:true,addContractorFirm:true,serviceQuote:true,landQuote:true,servicePlans:true,contractorPlans:true,signUp:true,bulkUpload:true,projectSales:true,abroadListing:true});
 // Estate agents and individuals are customers of firms, never invited to add one.
 assert.deepEqual(viewerActions('agent'),{postListing:true,addServiceFirm:false,addContractorFirm:false,serviceQuote:true,landQuote:true,servicePlans:false,contractorPlans:false,signUp:false,bulkUpload:true,projectSales:true,abroadListing:false});
 assert.deepEqual(viewerActions('individual'),{postListing:true,addServiceFirm:false,addContractorFirm:false,serviceQuote:true,landQuote:true,servicePlans:false,contractorPlans:false,signUp:false,bulkUpload:false,projectSales:false,abroadListing:true});
 assert.deepEqual(viewerActions('service'),{postListing:false,addServiceFirm:false,addContractorFirm:false,serviceQuote:false,landQuote:true,servicePlans:true,contractorPlans:false,signUp:false,bulkUpload:false,projectSales:false,abroadListing:false});
 assert.deepEqual(viewerActions('contractor'),{postListing:false,addServiceFirm:false,addContractorFirm:false,serviceQuote:true,landQuote:false,servicePlans:false,contractorPlans:true,signUp:false,bulkUpload:false,projectSales:false,abroadListing:false});
});
test('viewer from the account answer',()=>{
 assert.equal(viewerOf(null),'guest');assert.equal(viewerOf(undefined),'guest');
 assert.equal(viewerOf({accountKind:'agent'}),'agent');assert.equal(viewerOf({}),'individual');assert.equal(viewerOf({accountKind:'admin'}),'individual');
});
// Every header, footer and landing call to action goes through the same rules.
test('firm and quote buttons are gated in every sub-site component',()=>{
 const read=f=>readFileSync(new URL('../components/'+f,import.meta.url),'utf8');
 for(const [file,actions] of Object.entries({'ServiceHeader.tsx':['can.serviceQuote','can.addServiceFirm','can.servicePlans'],'ContractorChrome.tsx':['can.landQuote','can.addContractorFirm','can.contractorPlans','action="addContractorFirm"','action="landQuote"'],'ServiceFooter.tsx':['action="addServiceFirm"'],'ServicesLanding.tsx':['action="addServiceFirm"'],'ContractorDirectory.tsx':['action="landQuote"','action="addContractorFirm"'],'Header.tsx':['viewerActions(viewer).postListing'],'Footer.tsx':['action="signUp"','action="bulkUpload"','action="postListing"'],'HomePage.tsx':['action="signUp"','action="abroadListing"'],'CompanyDirectory.tsx':['action="signUp"'],'CompanyProfile.tsx':['action="signUp"'],'ProjectsExplorer.tsx':['action="projectSales"']}))
  for(const action of actions)assert.ok(read(file).includes(action),`${file}: ${action}`);
 assert.doesNotMatch(read('Header.tsx'),/href="\/ilan-ver"/);
});
