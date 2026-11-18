import { transcriptionModel } from '../infrastructure/chat/mediaSupport.js';
import assert from 'node:assert/strict';
import OpenAI, {toFile} from 'openai';
import {readFile} from 'node:fs/promises';
import {Env} from '../infrastructure/config/env.js';
import {ResponsesClient} from '../infrastructure/integrations/openai/ResponsesClient.js';
import {contaMagnoCommercialCatalog} from '../application/catalog/contaMagnoCommercialCatalog.js';
import {contaMagnoAssistantPrompt} from '../application/prompts/contaMagnoAssistantPrompt.js';

function syntheticPdf():Buffer {
 const stream='BT /F1 16 Tf 40 740 Td (Invoice SYNTHETIC-42 Total 1234 MXN) Tj ET';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
 let pdf='%PDF-1.4\n';const offsets=[0];
 objects.forEach((object,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${object}\nendobj\n`});
 const start=Buffer.byteLength(pdf);pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
 for(const offset of offsets.slice(1))pdf+=`${String(offset).padStart(10,'0')} 00000 n \n`;
 return Buffer.from(pdf+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`);
}

// Only synthetic fixtures. No database or WhatsApp imports.
async function main(){
 const ai=new OpenAI({apiKey:Env.openAiApiKey,timeout:90000,maxRetries:0});
 const client=new ResponsesClient(ai);let conversationId:string|null=null;let fileId:string|null=null;
 try{
  if(process.argv[2]){
   const transcript=await ai.audio.transcriptions.create({model:transcriptionModel(),file:await toFile(await readFile(process.argv[2]),'synthetic.mp3')});
   assert.ok(transcript.text.trim());
   conversationId=(await ai.conversations.create()).id;
   await ai.conversations.items.create(conversationId,{items:[{type:'message',role:'user',content:'Envié un audio attachmentId=synthetic_audio; atiende lo que solicito en él.'}]});
   let audioRead=false;
   const audioReply=await client.runResponse({conversationId,prompt:contaMagnoAssistantPrompt,contextJson:{conversation:{flowCompleted:true,isFirstReply:true},commercialCatalog:contaMagnoCommercialCatalog},shouldContinue:async()=>true,onToolCall:async call=>{
    assert.equal(call.name,'readConversationAttachment');assert.equal(call.arguments.attachmentId,'synthetic_audio');audioRead=true;
    return [{type:'input_text',text:`Transcripción del audio sintético: ${transcript.text}`}];
   }});
   assert.ok(audioRead);assert.match(audioReply.output.replyText,/anual/i);
   await client.deleteConversation(conversationId);conversationId=null;
   console.log('Audio sintético transcrito y respondido mediante lectura de tool; no se envió WhatsApp.');
  }
  for(const fixture of [{name:'synthetic.xml',mime:'application/xml',data:Buffer.from('<invoice folio="SYNTHETIC-42" currency="MXN" total="1234"/>')},{name:'synthetic.pdf',mime:'application/pdf',data:syntheticPdf()}]) {
  const file=await ai.files.create({purpose:'user_data',file:await toFile(fixture.data,fixture.name,{type:fixture.mime})});fileId=file.id;
  conversationId=await client.syncHistory({conversationId:null,messages:[{id:'synthetic',direction:'IN',text:'Lee el adjunto attachmentId=synthetic y dime su folio e importe. Es una prueba sintética.',openAiSyncedAt:null}],onConversationCreated:async id=>{conversationId=id},onMessagesSynced:async()=>{},shouldContinue:async()=>true});
  let read=false;
  const result=await client.runResponse({conversationId,prompt:contaMagnoAssistantPrompt,contextJson:{conversation:{flowCompleted:true},inquiry:{status:'CLOSED'},attachments:[{attachmentId:'synthetic',name:fixture.name}]},shouldContinue:async()=>true,onToolCall:async call=>{
   assert.equal(call.name,'readConversationAttachment');assert.equal(call.arguments.attachmentId,'synthetic');read=true;
   return [{type:'input_file',file_id:fileId}];
  }});
  assert.ok(read);assert.ok(result.output.replyText.includes('SYNTHETIC-42'));assert.ok(result.output.replyText.includes('1,234')||result.output.replyText.includes('1234'));
  console.log(`Lectura real de ${fixture.name} mediante tool multimodal validada; sin WhatsApp.`);
  await client.deleteConversation(conversationId);conversationId=null;await ai.files.delete(fileId);fileId=null;
  }
 }finally{if(conversationId)await client.deleteConversation(conversationId);if(fileId)await ai.files.delete(fileId)}
}
main().catch(error=>{console.error('Prueba de IA fallida:',error instanceof Error?error.name:'Unknown');process.exitCode=1});
