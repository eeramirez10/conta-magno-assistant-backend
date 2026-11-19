import assert from 'node:assert/strict';
import OpenAI from 'openai';
import { Env } from '../infrastructure/config/env.js';
import { scopeInstructions, scopeSchema, parseScopeAssessment, scopeTransition } from '../infrastructure/chat/scopeSupport.js';
import { contaMagnoCommercialCatalog } from '../application/catalog/contaMagnoCommercialCatalog.js';
import { contaMagnoAssistantPrompt } from '../application/prompts/contaMagnoAssistantPrompt.js';
import { ResponsesClient } from '../infrastructure/integrations/openai/ResponsesClient.js';
const ai=new OpenAI({apiKey:Env.openAiApiKey});
const messages:Array<{direction:string;text:string}>=[];
let state='ACTIVE';
for(const [text,expected] of [['Estoy triste, interpreta esta frase de agotamiento emocional','OUT_OF_SCOPE'],['Sí, quiero hablar de mi tristeza','OUT_OF_SCOPE'],['¿Puedes ayudarme con mi declaración anual?','IN_SCOPE'],['Me preocupan mis deudas del negocio, necesito controlar el flujo de efectivo','IN_SCOPE'],['Hola','IN_SCOPE']] as const){
 if(process.argv.includes('--welcome-only'))break;
 messages.push({direction:'IN',text});
 const response=await ai.responses.create({model:Env.openAiModel,instructions:scopeInstructions,input:JSON.stringify({state,catalog:contaMagnoCommercialCatalog,messages}),text:{format:{type:'json_schema',name:'scope',strict:true,schema:scopeSchema}},reasoning:{effort:'low'}});
 const result=parseScopeAssessment(JSON.parse(response.output_text));assert.equal(result.decision,expected);state=scopeTransition(state,result.decision);
 if(result.replyText)messages.push({direction:'OUT',text:result.replyText});
 console.log(JSON.stringify({scenario:text,decision:result.decision,state,reply:result.replyText}));
}
const client=new ResponsesClient(ai);let remote:string|null=null;
try{
 remote=(await ai.conversations.create()).id;
 await ai.conversations.items.create(remote,{items:[{type:'message',role:'user',content:'Hola'}]});
 const result=await client.runResponse({conversationId:remote,prompt:contaMagnoAssistantPrompt,contextJson:{conversation:{isFirstReply:true,flowCompleted:false},commercialCatalog:contaMagnoCommercialCatalog},shouldContinue:async()=>true,onToolCall:async()=>({ok:false,error:'Prueba sintética sin efectos externos'})});
 assert.equal(result.output.replyText.split('\n').filter(line=>/^\d+\.\s/.test(line.trim())).length,4,result.output.replyText);
 assert.doesNotMatch(result.output.replyText,/asistente virtual/i);assert.match(result.output.replyText,/bienvenid/i);assert.match(result.output.replyText,/CFO/);assert.match(result.output.replyText,/consultor/i);console.log(JSON.stringify({welcome:result.output.replyText}));
 await ai.conversations.items.create(remote,{items:[{type:'message',role:'user',content:'2'}]});
 const choice=await client.runResponse({conversationId:remote,prompt:contaMagnoAssistantPrompt,contextJson:{conversation:{isFirstReply:false,flowCompleted:false},commercialCatalog:contaMagnoCommercialCatalog},shouldContinue:async()=>true,onToolCall:async()=>({ok:false,error:'Prueba sintética sin efectos externos'})});
 assert.equal(choice.output.extractedFields.clientType,undefined);
 assert.match(choice.output.replyText,/CFO|financier|flujo|rentabilidad/i);
 console.log(JSON.stringify({serviceChoice:choice.output.replyText}));
}finally{if(remote)await client.deleteConversation(remote)}
