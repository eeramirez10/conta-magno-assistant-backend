import test from 'node:test';
import assert from 'node:assert/strict';
import {transcriptionModel,uploadFilename,trustedMediaUrl,blockFailure} from '../src/infrastructure/chat/mediaSupport.js';
test('a configuration variable name is never sent as an audio model ID',()=>{
 for(const value of ['', 'OPENAI_TRANSCRIPTION_MODEL','$OPENAI_TRANSCRIPTION_MODEL','${OPENAI_TRANSCRIPTION_MODEL}'])assert.equal(transcriptionModel(value),'gpt-transcribe');
 assert.equal(transcriptionModel('gpt-4o-transcribe'),'gpt-4o-transcribe');
});
test('received document names keep a correct file extension for OpenAI',()=>{
 assert.equal(uploadFilename('balance.2026','application/pdf'),'balance.2026.pdf');
 assert.equal(uploadFilename('balance.PDF','application/pdf'),'balance.PDF');
 assert.equal(uploadFilename('Foto','image/jpeg'),'Foto.jpg');
});
test('media downloads allow Meta CDN redirects without allowing unrelated URLs',()=>{
 for(const url of ['https://lookaside.fbsbx.com/file','https://cdn.fbsbx.com/file','https://mmg.whatsapp.net/file'])assert.ok(trustedMediaUrl(url));
 for(const url of ['http://lookaside.fbsbx.com/file','https://fbsbx.com.attacker.test/file','https://user:pass@lookaside.fbsbx.com/file','https://127.0.0.1/file'])assert.throws(()=>trustedMediaUrl(url));
});
test('Meta per-number rejection explains the partial failure',()=>{
 assert.equal(blockFailure({success:true}),null);
 assert.equal(blockFailure({block_users:{added_users:[{wa_id:'test'}]}}),null);
 assert.match(blockFailure({block_users:{failed_users:[{errors:[{code:123,message:'No recent interaction'}]}]}})!,/123/);
});
