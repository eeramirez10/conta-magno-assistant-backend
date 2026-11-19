import assert from 'node:assert/strict';
import {ResponsesClient,type HistoryMessage} from '../infrastructure/integrations/openai/ResponsesClient.js';
import {contaMagnoAssistantPrompt} from '../application/prompts/contaMagnoAssistantPrompt.js';
import {contaMagnoCommercialCatalog} from '../application/catalog/contaMagnoCommercialCatalog.js';
import {CONTRIBUYENTE_TYPE_OPTIONS} from '../domain/enums/ContribuyenteType.js';

// Synthetic Responses conversations only: no database, WhatsApp or notification imports.
const client=new ResponsesClient();
for(const [answer,expected] of [['1','PF_RESICO'],['la segunda opción','PF_ACTIVIDAD_EMPRESARIAL_Y_PROFESIONAL'],['10','NO_LO_SE_AUN'],['Persona Moral - Régimen General','PM_REGIMEN_GENERAL']] as const){
 if(process.argv[2] && answer!==process.argv[2])continue;
 let remote:string|null=null;
 const history:HistoryMessage[]=[{id:'question',direction:'OUT',text:'¿Sí, este es el número de WhatsApp correcto desde el que escribes? (Sí/No)',openAiSyncedAt:null},{id:'confirmation',direction:'IN',text:'Sí, este WhatsApp es correcto.',openAiSyncedAt:null}];
 const context={contact:{id:'synthetic_contact',waId:'525500000000',fullName:'Prospecto Sintético',email:'synthetic@example.com',phoneE164:'525500000000'},conversation:{id:'synthetic_conversation',stage:'QUALIFYING',flowCompleted:false,isFirstReply:false},inquiry:{id:'synthetic_inquiry',status:'NEW',mainNeed:'Atención contable habitual',recommendedPlan:'Básico',specialtyProfile:'Interés confirmado en contratar el paquete Básico. Ya proporcionó nombre, correo y confirmó WhatsApp; solo falta el régimen fiscal.'},commercialCatalog:contaMagnoCommercialCatalog,contribuyenteTypes:CONTRIBUYENTE_TYPE_OPTIONS};
 const run=()=>client.runResponse({conversationId:remote!,prompt:contaMagnoAssistantPrompt,contextJson:context,shouldContinue:async()=>true,onToolCall:async()=>({ok:false,error:'Prueba sintética: usa extractedFields sin efectos externos.'})});
 const sync=async()=>{remote=await client.syncHistory({conversationId:remote,messages:history,shouldContinue:async()=>true,onConversationCreated:async id=>{remote=id},onMessagesSynced:async(ids,at)=>{for(const message of history)if(ids.includes(message.id))message.openAiSyncedAt=at}})};
 try{
  await sync();const first=await run();
  const lines=first.output.replyText.split('\n').filter(line=>/^\d+\.\s/.test(line.trim()));
  assert.equal(lines.length,CONTRIBUYENTE_TYPE_OPTIONS.length,first.output.replyText);
  lines.forEach((line,index)=>assert.ok(line.trim().startsWith(`${index+1}. `)));
  assert.doesNotMatch(first.output.replyText,/PF_RESICO|NO_LO_SE_AUN/);
  history.push({id:'options',direction:'OUT',text:first.output.replyText,openAiSyncedAt:first.syncedAt},{id:'answer',direction:'IN',text:answer,openAiSyncedAt:null});
  await sync();const second=await run();assert.equal(second.output.extractedFields.clientType,expected);
  console.log(JSON.stringify({answer,clientType:second.output.extractedFields.clientType,options:first.output.replyText}));
 }finally{if(remote)await client.deleteConversation(remote)}
}
