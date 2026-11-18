import test from 'node:test';
import assert from 'node:assert/strict';
import {scopeTransition,parseScopeAssessment} from '../src/infrastructure/chat/scopeSupport.js';
import { fixture } from './helpers.js';
test('scope warning, silence, unreadable preservation and relevant recovery use model decisions',()=>{
 assert.equal(scopeTransition('ACTIVE','OUT_OF_SCOPE'),'WARNED');
 assert.equal(scopeTransition('WARNED','OUT_OF_SCOPE'),'PAUSED');
 assert.equal(scopeTransition('PAUSED','OUT_OF_SCOPE'),'PAUSED');
 assert.equal(scopeTransition('PAUSED','UNREADABLE'),'PAUSED');
 assert.equal(scopeTransition('PAUSED','IN_SCOPE'),'ACTIVE');
 assert.throws(()=>parseScopeAssessment({decision:'arbitrary',replyText:null}));
 assert.throws(()=>parseScopeAssessment({decision:'IN_SCOPE',replyText:'invalid'}));
});
test('scope gate runs before lead creation and does not call commercial tools while silent',async()=>{
 const f=fixture();let turn=0;
 f.orchestrator.scopeGate=async()=>({proceed:++turn===3,replyText:turn===1?'Aviso generado por modelo':null});
 await f.orchestrator.processIncoming(f.provider,f.incoming('unrelated'));
 await f.orchestrator.processIncoming(f.provider,f.incoming('insistence'));
 assert.equal(f.sent.length,1);assert.equal(f.effects.createdInquiries,0);assert.equal(f.remote.requests.length,0);
 await f.orchestrator.processIncoming(f.provider,f.incoming('business'));
 assert.equal(f.sent.length,2);assert.equal(f.effects.createdInquiries,1);
});
test('first reply context is true once and false after an outbound',async()=>{
 const f=fixture();await f.orchestrator.processIncoming(f.provider,f.incoming('hello'));
 assert.ok(f.remote.requests[0].instructions.includes('"isFirstReply":true'));
 await f.orchestrator.processIncoming(f.provider,f.incoming('next'));
 assert.ok(f.remote.requests[1].instructions.includes('"isFirstReply":false'));
});
