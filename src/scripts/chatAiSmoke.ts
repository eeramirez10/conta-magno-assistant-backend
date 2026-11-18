import assert from 'node:assert/strict';
import OpenAI, {toFile} from 'openai';
import {readFile} from 'node:fs/promises';
import {Env} from '../infrastructure/config/env.js';
import {ResponsesClient} from '../infrastructure/integrations/openai/ResponsesClient.js';
import {contaMagnoAssistantPrompt} from '../application/prompts/contaMagnoAssistantPrompt.js';
// Only synthetic fixtures. No database or WhatsApp imports.
async function main(){
 const ai=new OpenAI({apiKey:Env.openAiApiKey,timeout:90000,maxRetries:0});
 const client=new ResponsesClient(ai);let conversationId:string|null=null;let fileId:string|null=null;
 try{
  if(process.argv[2]){
   const transcript=await ai.audio.transcriptions.create({model:process.env.OPENAI_TRANSCRIPTION_MODEL||'gpt-transcribe',file:await toFile(await readFile(process.argv[2]),'synthetic.mp3')});
   assert.ok(transcript.text.trim());
   console.log('Audio sintético transcrito correctamente; no se envió WhatsApp.');
  }
  const file=await ai.files.create({purpose:'user_data',file:await toFile(Buffer.from('<invoice folio="SYNTHETIC-42" currency="MXN" total="1234"/>'),'synthetic.xml',{type:'application/xml'})});fileId=file.id;
  conversationId=await client.syncHistory({conversationId:null,messages:[{id:'synthetic',direction:'IN',text:'Lee el adjunto attachmentId=synthetic y dime su folio e importe. Es una prueba sintética.',openAiSyncedAt:null}],onConversationCreated:async id=>{conversationId=id},onMessagesSynced:async()=>{},shouldContinue:async()=>true});
  let read=false;
  const result=await client.runResponse({conversationId,prompt:contaMagnoAssistantPrompt,contextJson:{conversation:{flowCompleted:true},inquiry:{status:'CLOSED'},attachments:[{attachmentId:'synthetic',name:'synthetic.xml'}]},shouldContinue:async()=>true,onToolCall:async call=>{
   assert.equal(call.name,'readConversationAttachment');assert.equal(call.arguments.attachmentId,'synthetic');read=true;
   return [{type:'input_file',file_id:fileId}];
  }});
  assert.ok(read);assert.ok(result.output.replyText.includes('SYNTHETIC-42'));assert.ok(result.output.replyText.includes('1,234')||result.output.replyText.includes('1234'));
  console.log('Lectura real de XML mediante tool multimodal validada; sin WhatsApp.');
 }finally{if(conversationId)await client.deleteConversation(conversationId);if(fileId)await ai.files.delete(fileId)}
}
main().catch(error=>{console.error('Prueba de IA fallida:',error instanceof Error?error.name:'Unknown');process.exitCode=1});
