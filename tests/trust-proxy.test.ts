import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import rateLimit from 'express-rate-limit';
import {trustProxyHops} from '../src/infrastructure/config/trustProxy.js';

test('proxy configuration defaults to a bounded production hop and validates overrides',()=>{
 assert.equal(trustProxyHops(undefined,true),1);
 assert.equal(trustProxyHops(undefined,false),0);
 assert.equal(trustProxyHops('0',true),0);
 assert.equal(trustProxyHops('2',true),2);
 for(const value of ['true','false','-1','1.5','Infinity','NaN']) assert.throws(()=>trustProxyHops(value,true));
});

test('proxied clients have independent limits and forged leading XFF entries do not bypass them',async()=>{
 const app=express();app.set('trust proxy',trustProxyHops(undefined,true));
 app.use(rateLimit({windowMs:60000,limit:2,standardHeaders:true,legacyHeaders:false}));
 app.get('/',(req,res)=>res.json({ip:req.ip}));
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
 const address=server.address() as {port:number};const url=`http://127.0.0.1:${address.port}`;
 const request=(ip:string)=>fetch(url,{headers:{'X-Forwarded-For':ip}});
 try{
  const first=await request('198.51.100.10');assert.equal(first.status,200);assert.equal((await first.json()).ip,'198.51.100.10');
  assert.equal((await request('203.0.113.20')).status,200);
  assert.equal((await request('198.51.100.10')).status,200);
  assert.equal((await request('198.51.100.10')).status,429);
  assert.equal((await request('192.0.2.99, 198.51.100.10')).status,429);
  assert.equal((await request('203.0.113.20')).status,200);
 }finally{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()))}
});
