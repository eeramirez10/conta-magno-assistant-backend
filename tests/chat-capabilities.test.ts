import assert from 'node:assert/strict';
import test from 'node:test';
import { CONTROL_MS, validLease, validateMedia, IMAGE_LIMIT, DOCUMENT_LIMIT } from '../src/infrastructure/chat/ChatRuntime.js';

test('control expires at exactly two minutes and stale sessions cannot renew it', () => {
 const now = 1000;
 const session = {sessionId:'active',expiresAt:new Date(now+CONTROL_MS)};
 assert.equal(CONTROL_MS,120000);
 assert.equal(validLease(session,'active',now+119999),true);
 assert.equal(validLease(session,'active',now+120000),false);
 assert.equal(validLease(session,'previous',now),false);
 assert.equal(validLease(null,'active',now),false);
});
test('media validation reads bytes instead of trusting a supplied filename', async () => {
 await assert.rejects(validateMedia(Buffer.from('not a pdf'),'tax.pdf',false));
 await assert.rejects(validateMedia(Buffer.from([0,1,2]),'invoice.xml',false));
 assert.equal(await validateMedia(Buffer.from('<invoice total="100"/>'),'invoice.xml',false),'application/xml');
 assert.equal(await validateMedia(Buffer.from('month,total\n1,100'),'budget.csv',false),'text/csv');
 await assert.rejects(validateMedia(Buffer.alloc(DOCUMENT_LIMIT+1),'budget.csv',false));
 const png=Buffer.concat([Buffer.from('89504e470d0a1a0a0000000d49484452','hex'),Buffer.alloc(IMAGE_LIMIT)]);
 await assert.rejects(validateMedia(png,'photo.png',false));
});
test('outbound audio and executable files are rejected', async () => {
 const wav=Buffer.alloc(44);wav.write('RIFF',0);wav.write('WAVE',8);wav.write('fmt ',12);
 await assert.rejects(validateMedia(wav,'audio.wav',false));
 await assert.rejects(validateMedia(Buffer.from('#!/bin/sh\necho bad'),'script.sh',false));
});
