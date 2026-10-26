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
  PerformancePoint:object({period:str,version:integer,netSalesWon:money,poolWon:money}),
  Performance:object({offeringId:uuid,points:array('PerformancePoint'),mode:{const:'SIMULATION',type:'string'}}),
  Error:object({code:str,message:str},['message']),
  Offering:object({id:uuid,run_id:uuid,store_name:str,title:str,owner_address:address,contract_version:integer,target_units:integer,unit_price:money,rate_bps:integer,months:integer,starts_on:{type:'string',format:'date'},status:str,token_id:money,accepted_units:integer,risk:str,principal_redemption:str,mode:{const:'SIMULATION',type:'string'}}),
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
  Subscribe:object({units:{type:'integer',minimum:1,maximum:3600},requestKey:uuid,understood:bool}),
  Upload:object({offeringId:uuid,filename:str,contentType:{type:'string',enum:['application/pdf','image/png','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']},sizeBytes:{type:'integer',minimum:1,maximum:5242880}}),
};
const paths={};
const json=schema=>({'application/json':{schema}});
function route(path,method,name,response={type:'object',additionalProperties:true},body,publicRead=false) {
  const parameters=[...path.matchAll(/\{(\w+)\}/g)].map(m=>({name:m[1],in:'path',required:true,schema:m[1]==='address'?address:uuid}));
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
