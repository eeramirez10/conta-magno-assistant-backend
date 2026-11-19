import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const url=process.env.CHAT_TEST_DATABASE_URL;
test('chat runtime persists moderation, attachments, single-use links and control across instances', {skip:!url}, async()=>{
 const parsed=new URL(url!);assert.equal(parsed.hostname,'127.0.0.1');assert.ok(parsed.pathname.endsWith('_test'));
 process.env.DATABASE_URL=url!;
 const {prisma}=await import('../src/infrastructure/database/prisma.js');
 const {ChatRuntime}=await import('../src/infrastructure/chat/ChatRuntime.js');
 const directory=await mkdtemp(join(tmpdir(),'conta-chat-'));process.env.MEDIA_STORAGE_DIR=directory;
 let disposition='RELEVANT';let replies=0;let notices=0;let blockFails=false;
 const contacts:any={isDeleting:()=>false,withConversationActivity:async(_id:string,work:()=>Promise<any>)=>work(),upsert:async(d:any)=>prisma.contact.upsert({where:{waId:d.waId},update:{},create:{waId:d.waId,fullName:d.fullName,phoneE164:d.phoneE164}})};
 const conversations:any={createOrGetActive:async(contactId:string)=>await prisma.conversation.findFirst({where:{contactId}})??prisma.conversation.create({data:{contactId,provider:'META'}}),takeHumanControl:async(id:string)=>prisma.conversation.update({where:{id},data:{stage:'PENDING_HUMAN'}})};
 const runtime=new ChatRuntime(conversations,contacts,{processSavedIncoming:async()=>{replies++}} as any,{sendTextMessage:async()=>({providerMessageId:'out-test'})} as any,{conversationUpdated:()=>{}} as any,{notifyMessage:async()=>{notices++}} as any);
 const internal=runtime as any;
 internal.ai={responses:{create:async(p:any)=>({status:'completed',output_text:JSON.stringify(p.instructions.startsWith('Clasifica')?{decision:disposition,reason:'synthetic'}:{shouldReply:false,messageId:null})})},files:{create:async()=>({id:'file-test'}),delete:async()=>{}}};
 internal.meta=async()=>{if(blockFails)throw new Error('Meta rejected');return {success:true}};
 const incoming=(id:string,text='Necesito contabilidad')=>({entry:[{changes:[{value:{messages:[{id,from:'525511111111',type:'text',text:{body:text}}]}}]}]});
 try{
  await mkdir(directory,{recursive:true});
  await runtime.ingest(incoming('first'));await runtime.ingest(incoming('first'));
  assert.equal(await prisma.message.count(),1);
  await internal.tick();assert.equal(replies,1);assert.equal(notices,1);
  const c=await prisma.conversation.findFirstOrThrow();
  disposition='PROMOTION';await runtime.ingest(incoming('ad','Publicidad de prueba'));await internal.tick();
  assert.equal((await runtime.state(c.id)).policy.decision,'REVIEW');assert.equal(replies,1);assert.equal(notices,1);
  await runtime.setPolicy('525511111111','APPROVED');await internal.tick();
  const taken=await runtime.take(c.id);assert.ok(taken.control);
  await assert.rejects(runtime.activity(c.id,'stale-session'));
  await runtime.activity(c.id,taken.control!.sessionId);
  await prisma.chatControl.update({where:{conversationId:c.id},data:{expiresAt:new Date(0)}});
  await internal.finishLease(c.id,taken.control!.sessionId,true);
  assert.equal((await prisma.conversation.findUniqueOrThrow({where:{id:c.id}})).stage,'QUALIFYING');
  assert.equal((await runtime.state(c.id)).control,null);
  const upload=await runtime.createLink(c.id);const token=upload.split('/').at(-1)!;
  await runtime.receiveUpload(token,{buffer:Buffer.from('<invoice total="1"/>'),originalname:'invoice.xml'} as any);
  await assert.rejects(runtime.receiveUpload(token,{buffer:Buffer.from('x'),originalname:'x.csv'} as any));
  const a=await prisma.chatAttachment.findFirstOrThrow();
  assert.equal((await runtime.readAttachment(a.id,c.id))[1].type,'input_file');
  assert.equal((await runtime.readAttachment(a.id,'another'))[0].type,'input_text');
  const link=await runtime.createLink(c.id,a.id);assert.equal((await runtime.resolveLink(link.split('/').at(-1)!)).mode,'DOWNLOAD');
  // Reproduce a received PDF: metadata -> bounded CDN redirect -> bytes -> native file input.
  const originalFetch=globalThis.fetch;const originalMeta=internal.meta;
  const pdf=Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF');
  internal.meta=async()=>({url:'https://lookaside.fbsbx.com/test.pdf',file_size:pdf.length});
  let downloads=0;
  globalThis.fetch=async()=>++downloads===1?new Response(null,{status:302,headers:{location:'https://cdn.fbsbx.com/test.pdf'}}):new Response(pdf,{headers:{'content-type':'application/pdf'}});
  try{
   await runtime.ingest({entry:[{changes:[{value:{messages:[{id:'pdf-test',from:'525511111111',type:'document',document:{id:'media-test',filename:'balance.2026',mime_type:'application/pdf'}}]}}]}]});
   const received=await prisma.chatAttachment.findFirstOrThrow({where:{providerMediaId:'media-test'}});
   const prepared=await runtime.retryAttachment(received.id);assert.equal(prepared.ok,true);
   let uploadedName='';internal.ai.files.create=async(p:any)=>{uploadedName=p.file.name;return{id:'file-pdf'}};
   const parts=await runtime.readAttachment(received.id,c.id);assert.equal(parts[1].type,'input_file');assert.equal(uploadedName,'balance.2026.pdf');
   assert.equal(downloads,2);assert.equal((await prisma.chatAttachment.findUniqueOrThrow({where:{id:received.id}})).status,'READY');
  }finally{globalThis.fetch=originalFetch;internal.meta=originalMeta}
  const {default:express}=await import('express');
  const {chatCapabilitiesRouter}=await import('../src/presentation/http/routes/chatCapabilities.routes.js');
  const app=express();app.use(express.json());app.use(chatCapabilitiesRouter(runtime,{getAuthenticatedUser:async(token:string)=>token==='test'?{id:'test',username:'test'}:null} as any));
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  const address=server.address() as {port:number};const base=`http://127.0.0.1:${address.port}`;
  try{
   const received=await prisma.chatAttachment.findFirstOrThrow({where:{providerMediaId:'media-test'}});
   const denied=await fetch(`${base}/api/attachments/${received.id}/content`);assert.equal(denied.status,401);
   const response=await fetch(`${base}/api/attachments/${received.id}/content`,{headers:{Authorization:'Bearer test'}});assert.equal(response.status,200);assert.ok(response.headers.get('content-type')?.includes('application/pdf'));assert.ok((await response.text()).startsWith('%PDF-'));
   // Persisted development paths must resolve against this server's volume.
   const source=join(directory,'voice.ogg');
   execFileSync('ffmpeg',['-loglevel','error','-f','lavfi','-i','anullsrc=channel_layout=mono:sample_rate=16000','-t','0.2','-y',source]);
   const voiceBytes=await readFile(source);
   const voice=await prisma.chatAttachment.create({data:{messageId:received.messageId,name:'voice.ogg',mime:'audio/ogg',status:'READY',path:'/Users/other/storage/voice.ogg',playbackPath:'/Users/other/storage/voice.ogg.mp3',transcript:'Transcripción conservada',providerMediaId:'voice-media'}});
   const voiceUrl=`${base}/api/attachments/${voice.id}/content?playback=1`;
   const audio=await fetch(voiceUrl,{headers:{Authorization:'Bearer test'}});
   assert.equal(audio.status,200);assert.ok(audio.headers.get('content-type')?.includes('audio/mpeg'));assert.ok((await audio.arrayBuffer()).byteLength>0);
   await rm(source);await rm(`${source}.mp3`);
   const metaBefore=internal.meta;const fetchBefore=globalThis.fetch;
   internal.meta=async()=>({url:'https://cdn.fbsbx.com/voice.ogg',file_size:voiceBytes.length});
   globalThis.fetch=async(input:any,init:any)=>String(input)==='https://cdn.fbsbx.com/voice.ogg'?new Response(voiceBytes):fetchBefore(input,init);
   try{
    const recovered=await fetch(voiceUrl,{headers:{Authorization:'Bearer test'}});
    assert.equal(recovered.status,200);assert.ok((await recovered.arrayBuffer()).byteLength>0);
    assert.equal((await prisma.chatAttachment.findUniqueOrThrow({where:{id:voice.id}})).transcript,'Transcripción conservada');
   }finally{internal.meta=metaBefore;globalThis.fetch=fetchBefore}
   const missing=await prisma.chatAttachment.create({data:{messageId:received.messageId,name:'missing.ogg',mime:'audio/ogg',status:'READY',path:'/foreign/missing',transcript:'Conservada'}});
   assert.equal((await fetch(`${base}/api/attachments/${missing.id}/content?playback=1`,{headers:{Authorization:'Bearer test'}})).status,404);
   blockFails=true;
   const result=await fetch(`${base}/api/conversations/${c.id}/policy`,{method:'POST',headers:{Authorization:'Bearer test','Content-Type':'application/json'},body:JSON.stringify({decision:'BLOCKED'})});assert.equal(result.status,200);assert.equal((await result.json() as any).data.remoteStatus,'FAILED');
  }finally{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()))}
  blockFails=true;const blocked=await runtime.setPolicy('525511111111','BLOCKED');assert.equal(blocked.remoteStatus,'FAILED');assert.ok(blocked.warning);
  assert.equal(await runtime.allowed('525511111111'),false);
  assert.equal((await runtime.state(c.id)).policy.remoteStatus,'FAILED');
  const before=await prisma.chatJob.count();await runtime.ingest(incoming('blocked'));assert.equal(await prisma.chatJob.count(),before);
  await assert.rejects(runtime.resolveLink(link.split('/').at(-1)!));
  blockFails=false;await runtime.setPolicy('525511111111','BLOCKED');await runtime.setPolicy('525511111111','APPROVED');
  const fresh=await runtime.take(c.id);await assert.rejects(runtime.sendFiles(c.id,taken.control!.sessionId,[],'stale'));
  assert.notEqual(fresh.control!.sessionId,taken.control!.sessionId);
  // Read-only AI decisions persist across runtime instances, including approved numbers.
  const aiCreate=internal.ai.responses.create;
  let scopeDecision='OUT_OF_SCOPE';
  internal.ai.responses.create=async()=>({status:'completed',output_text:JSON.stringify({decision:scopeDecision,replyText:scopeDecision==='OUT_OF_SCOPE'?'Aviso del modelo':null})});
  const scopeMessage=async(text:string)=>prisma.message.create({data:{conversationId:c.id,direction:'IN',text,rawPayload:{}}});
  const firstScope=await scopeMessage('Tema personal');
  assert.equal((await runtime.scopeGate(c.id,firstScope.id,async()=>true)).replyText,'Aviso del modelo');
  assert.equal((await runtime.scopeGate(c.id,firstScope.id,async()=>true)).replyText,null);
  const restarted=new ChatRuntime(conversations,contacts,{} as any,{} as any,{conversationUpdated:()=>{}} as any,{} as any);
  (restarted as any).ai=internal.ai;
  const secondScope=await scopeMessage('Insistencia personal');
  assert.equal((await restarted.scopeGate(c.id,secondScope.id,async()=>true)).replyText,null);
  assert.equal((await runtime.state(c.id)).scopeControl.state,'PAUSED');
  scopeDecision='IN_SCOPE';
  const relevant=await scopeMessage('Necesito una declaración anual');
  assert.equal((await restarted.scopeGate(c.id,relevant.id,async()=>true)).proceed,true);
  assert.equal((await runtime.state(c.id)).scopeControl.state,'ACTIVE');
  const interrupted=await scopeMessage('Nuevo mensaje');
  assert.equal((await runtime.scopeGate(c.id,interrupted.id,async()=>false)).proceed,false);
  assert.equal((await prisma.message.findUniqueOrThrow({where:{id:interrupted.id}})).rawPayload.scopeAssessment,undefined);
  internal.ai.responses.create=aiCreate;
  await runtime.cleanup([c.id]);
 }finally{await prisma.$disconnect();await rm(directory,{recursive:true,force:true})}
});
