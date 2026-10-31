import {writeFile} from 'node:fs/promises';
import openapiTS, {astToString} from 'openapi-typescript';
const str={type:'string'}, integer={type:'integer'}, bool={type:'boolean'}, uuid={type:'string',format:'uuid'};
const money={type:'string',pattern:'^-?[0-9]+$',description:'Integer KRW, decimal string; SIMULATION only'};
const address={type:'string',pattern:'^0x[0-9a-fA-F]{40}$'};
const nullable={type:['string','null']};
const ref=name=>({$ref:`#/components/schemas/${name}`});
const array=name=>({type:'array',items:typeof name==='string'?ref(name):name});
const object=(properties,optional=[])=>({type:'object',properties,required:Object.keys(properties).filter(k=>!optional.includes(k))});
const schemas={
  DistributionConfig:object({offering_id:uuid,cash_address:address,vault_address:address,units_address:address,registry_address:address,checked_block:integer}),
  DistributionReceipt:object({id:uuid,kind:str,status:str,tx_hash:nullable,error_code:nullable,offering_id:uuid,store_name:str,period:str,version:integer,amount_units:money,address:nullable,line_id:nullable,cash_address:address,vault_address:address}),
  Distributions:object({payments:array('DistributionReceipt'),configs:array('DistributionConfig'),asset:{const:'DEMO',type:'string'},mode:{const:'SIMULATION',type:'string'}}),
  PublicReconciliation:object({grossWon:money,discountWon:money,refundWon:money,netWon:money,pgWon:nullable,bankWon:nullable,pgGapWon:nullable,bankGapWon:nullable,rowCount:integer,acceptedCount:integer,ready:bool,duplicateIgnored:integer,blockingCount:integer,issueCounts:array(object({code:str,count:integer,blocking:bool})),sources:array(object({name:str,available:bool}))}),
  TransparencyCase:object({id:str,period:str,label:str,basis:{type:'string',enum:['SYNTHETIC_CSV','APPROVED_LEDGER']},status:str,reconciliation:ref('PublicReconciliation'),version:{type:['integer','null']},settlementId:nullable,digest:nullable,chainStatus:str,chainTxHash:nullable,sourceHash:str}),
  Transparency:object({store:object({id:str,name:str,district:str,category:str}),approved:array('TransparencyCase'),submissions:array(object({period:str,status:str,blockingCount:integer,issueCounts:array(object({code:str,count:integer,blocking:bool}))})),samples:array('TransparencyCase'),mode:str,asOf:str}),
  AgentStatus:object({modelCalls:{type:'string',enum:['CONFIGURED','NOT_CONFIGURED','UNAVAILABLE']},status:{type:'string',enum:['REACHABLE','UNAVAILABLE']},mode:str}),
  MarketListing:object({store:ref('UxStore'),terms:ref('UxOffering'),offering:{anyOf:[ref('Offering'),{type:'null'}]},revenues:array('UxRevenue'),source:{type:'string',enum:['SIMULATION_LEDGER','SAMPLE_HISTORY']}}),
  MarketCatalog:object({listings:array('MarketListing'),mode:str,asOf:str}),
  InvestmentSubscription:{allOf:[ref('Subscription'),object({offering_id:uuid,store_name:str,unit_price:money,created_at:str})]},
  InvestmentHolding:{allOf:[ref('Holding'),object({offering_id:uuid,store_name:str,unit_price:money,offering_status:str})]},
  InvestmentSettlement:object({id:uuid,offering_id:uuid,store_name:str,period:str,version:integer,status:str,line_id:uuid,amount_won:money,paid_won:money,prior_paid_won:money,delta_won:money}),
  Investments:object({subscriptions:array('InvestmentSubscription'),holdings:array('InvestmentHolding'),settlements:array('InvestmentSettlement'),mode:str}),
  UxPersona:object({id:str,name:str,roles:array(str),participation:str,selectable:bool,synthetic:bool}),
  UxStore:object({id:str,name:str,district:str,category:str,ownerPersonaId:str,description:str,synthetic:bool}),
  UxOffering:object({id:str,storeId:str,title:str,status:str,targetUnits:integer,unitPriceWon:money,targetWon:money,rateBps:integer,months:integer,startsOn:str,principalRedemption:str,acceptedUnits:integer,synthetic:bool}),
  UxSubscription:object({id:str,offeringId:str,personaId:str,units:integer,allocatedUnits:integer,refundedUnits:integer,status:str,synthetic:bool}),
  UxHolding:object({id:str,offeringId:str,personaId:str,units:integer,chainUnits:integer,chainStatus:str,synthetic:bool}),
  UxRevenue:object({id:str,storeId:str,period:str,sourceCsv:str,sha256:str,netSalesWon:money,reconciled:bool,synthetic:bool}),
  UxEvidence:object({id:str,storeId:str,offeringId:str,period:str,status:str,sourceId:str,submittedBy:str,reviewedBy:nullable,synthetic:bool}),
  UxSettlement:object({id:str,offeringId:str,storeId:str,period:str,version:integer,previousId:nullable,status:str,sourceId:str,netSalesWon:money,poolWon:money,cashAvailableWon:money,calculatedBy:str,approvedBy:nullable,chainStatus:str,synthetic:bool}),
  UxLine:object({id:str,settlementId:str,holdingId:str,personaId:str,units:integer,amountWon:money,paidWon:money,priorPaidWon:money,deltaWon:money,unpaidWon:money,overpaidWon:money,synthetic:bool}),
  UxPayment:object({id:str,lineId:str,personaId:str,requestedWon:money,paidWon:money,outcome:str,synthetic:bool}),
  UxBenefit:object({id:str,storeId:str,offeringId:str,title:str,requiredUnits:integer,validFrom:str,validUntil:str,maxClaims:integer,maxPerPersona:integer,synthetic:bool}),
  UxClaim:object({id:str,benefitId:str,personaId:str,status:str,claimedOn:str,code:str,synthetic:bool}),
  UxBenefitState:object({personaId:str,benefitId:str,status:str,heldUnits:integer,synthetic:bool}),
  UxScenario:object({id:str,personaId:str,path:array(str),expected:str}),
  UxDemoDataset:object({datasetId:str,version:integer,asOf:str,mode:{const:'SIMULATION',type:'string'},source:{const:'SYNTHETIC_UX_FIXTURE',type:'string'},disclaimer:str,sourceSha256:str,personas:array('UxPersona'),stores:array('UxStore'),offerings:array('UxOffering'),subscriptions:array('UxSubscription'),holdings:array('UxHolding'),revenues:array('UxRevenue'),exceptionSources:array('UxRevenue'),evidence:array('UxEvidence'),settlements:array('UxSettlement'),settlementLines:array('UxLine'),payments:array('UxPayment'),benefits:array('UxBenefit'),claims:array('UxClaim'),benefitStates:array('UxBenefitState'),scenarios:array('UxScenario')}),
  UxPersonaView:object({datasetId:str,version:integer,asOf:str,mode:str,source:str,disclaimer:str,sourceSha256:str,persona:ref('UxPersona'),market:object({stores:array('UxStore'),offerings:array('UxOffering'),revenues:array('UxRevenue')}),portfolio:object({subscriptions:array('UxSubscription'),holdings:array('UxHolding'),settlements:array('UxSettlement'),lines:array('UxLine'),payments:array('UxPayment')}),storeManagement:object({stores:array('UxStore'),offerings:array('UxOffering'),evidence:array('UxEvidence'),revenues:array('UxRevenue'),exceptionSources:array('UxRevenue'),settlements:array('UxSettlement')}),reviewQueue:array('UxEvidence'),operations:object({settlements:array('UxSettlement'),offerings:array('UxOffering')}),availableSections:array(str)}),
  PerformancePoint:object({period:str,version:integer,netSalesWon:money,poolWon:money}),
  Performance:object({offeringId:uuid,points:array('PerformancePoint'),mode:{const:'SIMULATION',type:'string'}}),
  Error:object({code:str,message:str},['message']),
  Offering:object({id:uuid,run_id:uuid,store_name:str,title:str,owner_address:address,contract_version:integer,target_units:integer,unit_price:money,rate_bps:integer,months:integer,starts_on:{type:'string',format:'date'},status:str,token_id:money,accepted_units:integer,risk:str,principal_redemption:str,scenario_code:str,capital_purpose:str,revenue_scope:str,funding_use:str,mode:{const:'SIMULATION',type:'string'}}),
  Subscription:object({id:uuid,address,units:integer,refunded_units:integer,status:str,synthetic:bool}),
  Holding:object({id:uuid,address,units:integer,chain_units:integer,synthetic:bool}),
  Issue:object({code:str,eventId:str,message:str,blocking:bool}),
  Report:object({grossWon:money,discountWon:money,refundWon:money,netWon:money,pgWon:money,bankWon:money,rowCount:integer,acceptedCount:integer,ready:bool,issues:array('Issue')}),
  Evidence:object({id:uuid,period:str,filename:str,status:str,report:ref('Report'),submitted_by:address,reviewed_by:nullable}),
  Settlement:object({id:uuid,period:str,version:integer,status:str,pool_won:money,cash_available:money,digest:str,created_by:address,approved_by:nullable}),
  Line:object({id:uuid,settlement_id:uuid,address,units:integer,amount_won:money,paid_won:money,prior_paid_won:money,delta_won:money}),
  Job:object({id:uuid,kind:str,status:str,reference_id:uuid,target:nullable,calldata:nullable,tx_hash:nullable,block_number:{type:['integer','null']},error_code:nullable}),
  Attachment:object({id:uuid,filename:str,size_bytes:integer,status:str}),
  Explanation:object({explanation:str,sourceIds:array(str),uncertainties:array(str),dataVersion:str,mode:str}),
  PaymentAttempt:object({id:uuid,requested_won:money,paid_won:money,outcome:str,created_at:str}),
  Statement:object({id:uuid,period:str,version:integer,status:str,latest:bool,netSalesWon:money,rateBps:integer,totalUnits:integer,ownUnits:integer,poolWon:money,amountWon:money,priorPaidWon:money,paidWon:money,unpaidWon:money,overpaidWon:money,deltaWon:money,cashAvailableWon:money,cashShortfallWon:money,dataVersion:str,evidenceId:uuid,evidenceStatus:str,sourceHash:str,algorithm:str,payments:array('PaymentAttempt'),mode:{const:'SIMULATION',type:'string'}}),
  Contract:object({units_address:address,registry_address:address,operator_address:address}),
  User:object({address,role:str}),
  MySettlement:{allOf:[ref('Settlement'),ref('Line'),object({line_id:uuid})]},
  Event:object({id:uuid,actor:address,action:str,reason:str}),
  Dashboard:object({offering:ref('Offering'),user:ref('User'),subscriptions:array('Subscription'),holdings:array('Holding'),settlements:array('MySettlement'),chain_jobs:array('Job'),evidence:array('Evidence'),all_subscriptions:array('Subscription'),all_holdings:array('Holding'),all_settlements:array('Settlement'),all_lines:array('Line'),all_jobs:array('Job'),events:array('Event'),contracts:array('Contract')},['evidence','all_subscriptions','all_holdings','all_settlements','all_lines','all_jobs','events']),
  Reason:object({reason:{type:'string',minLength:1,maxLength:500}}),
  Subscribe:object({units:{type:'integer',minimum:1},requestKey:uuid,understood:bool}),
  Upload:object({offeringId:uuid,filename:str,contentType:{type:'string',enum:['application/pdf','image/png','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']},sizeBytes:{type:'integer',minimum:1,maximum:5242880}}),
};
const paths={};
const json=schema=>({'application/json':{schema}});
function route(path,method,name,response={type:'object',additionalProperties:true},body,publicRead=false) {
  const parameters=[...path.matchAll(/\{(\w+)\}/g)].map(m=>({name:m[1],in:'path',required:true,schema:m[1]==='address'?address:['personaId','storeId'].includes(m[1])?{type:'string',pattern:'^[a-z0-9-]{1,80}$'}:uuid}));
  const operation={operationId:name,security:publicRead?[]:[{session:[]}],parameters,responses:{200:{description:'Success',content:json(typeof response==='string'?ref(response):response)},400:{description:'Invalid input',content:json(ref('Error'))},401:{description:'Session required',content:json(ref('Error'))},403:{description:'Role, ownership, Origin or CSRF rejected',content:json(ref('Error'))},409:{description:'State conflict or Dojang required',content:json(ref('Error'))},503:{description:'Dependency unavailable; never interpreted as success',content:json(ref('Error'))}}};
  if(method==='post') {
    operation.parameters.push({name:'X-CSRF-TOKEN',in:'header',required:true,schema:str});
    if(body) operation.requestBody={required:true,content:json(typeof body==='string'?ref(body):body)};
  }
  (paths[path]??={})[method]=operation;
}
route('/api/v1/offerings/current','get','currentOffering','Offering',undefined,true);
route('/api/v1/offerings/current/performance','get','offeringPerformance','Performance',undefined,true);
const p='/api/v1/workbench';
route(p+'/distributions','get','distributionReceipts','Distributions');
route(p+'/distribution/contracts','post','registerDistributionContracts',undefined,object({cashAddress:address,vaultAddress:address}));
route(p+'/settlements/{id}/fund-distribution','post','fundDistribution','Job');
route(p+'/lines/{id}/distribute','post','payDistribution','Job');
route(p+'/agent/status','get','agentConnectionStatus','AgentStatus');
route(p+'/market','get','marketCatalog','MarketCatalog');
route(p+'/investments','get','ownInvestments','Investments');
route(p+'/transparency/{storeId}','get','storeTransparency','Transparency');
route(p+'/agent/chat','post','chatWithAgent','Explanation',object({question:{type:'string',minLength:1,maxLength:500},storeId:str},['storeId']));
route(p+'/demo-data','get','uxDemoDataset','UxDemoDataset');
route(p+'/demo-data/personas/{personaId}','get','uxDemoPersona','UxPersonaView');
route(p+'/dashboard','get','dashboard','Dashboard');
route(p+'/members','post','assignRole',undefined,object({address,role:{type:'string',enum:['INVESTOR','MERCHANT','REVIEWER']},ownStore:bool}));
route(p+'/evidence','post','submitEvidence','Evidence',object({offeringId:uuid,period:str,filename:str,csv:{type:'string',maxLength:1000000}}));
route(p+'/evidence/{id}','get','evidence','Evidence');
route(p+'/evidence/{id}/close','post','closeEvidence','Evidence','Reason');
route(p+'/offerings/{id}/subscribe','post','subscribe','Subscription','Subscribe');
route(p+'/subscriptions/{id}/cancel','post','cancelSubscription');
route(p+'/background','post','loadSyntheticBackground','Offering');
for(const action of ['allocate','underfunded','mature']) route(p+'/offerings/{id}/'+action,'post',action);
route(p+'/reset','post','newDemoRun','Offering');
route(p+'/settlements','post','calculateSettlement',undefined,object({evidenceId:uuid,reason:str}));
route(p+'/settlements/{id}','get','settlement');
route(p+'/settlements/{id}/statement','get','ownSettlementStatement','Statement');
route(p+'/settlements/{id}/approve','post','approveSettlement',undefined,'Reason');
route(p+'/settlements/{id}/digest','post','checkDigest',undefined,object({tamper:bool}));
route(p+'/lines/{id}/pay','post','simulatePayment',undefined,object({amountWon:{type:'integer',minimum:1},outcome:{type:'string',enum:['SUCCESS','PARTIAL','FAIL']},requestKey:uuid}));
route(p+'/settlements/{id}/explain','post','explainSettlement','Explanation',object({question:str}));
route(p+'/settlements/{id}/private-distribution','post','bojagiUnavailable');
delete paths[p+'/settlements/{id}/private-distribution'].post.responses[200];
route(p+'/contracts','post','registerContracts',undefined,object({unitsAddress:address,registryAddress:address}));
for(const action of ['prepare','transaction','check','retry']) route(p+'/jobs/{id}/'+action,'post','job'+action,'Job',action==='transaction'?object({hash:str}):undefined);
route(p+'/attachments','get','attachments',array('Attachment'));
route(p+'/attachments/upload-url','post','attachmentUploadUrl',undefined,'Upload');
route(p+'/attachments/{id}/complete','post','completeAttachment');
route(p+'/attachments/{id}/download-url','get','attachmentDownloadUrl');
const schema={openapi:'3.1.0',info:{title:'UpDish hackathon business API',version:'0.2.0',description:'Core business contract. Web BFF maps /api/workbench/* to /api/v1/workbench/*. Every write also requires an exact allowed Origin. Auth and public GIWA diagnostic APIs are documented in wallet-guide.md. Bojagi always returns 503 until an official integration is available.'},paths,components:{securitySchemes:{session:{type:'apiKey',in:'cookie',name:'UPDISH_SESSION'}},schemas}};
await writeFile(new URL('../docs/openapi.json',import.meta.url),JSON.stringify(schema,null,2)+'\n');
await writeFile(new URL('../apps/web/lib/api.generated.ts',import.meta.url),'// Generated by pnpm generate:api. Edit scripts/api-contract.mjs.\n'+astToString(await openapiTS(schema)));
console.log(`Generated ${Object.keys(paths).length} business API paths and shared Web types.`);
