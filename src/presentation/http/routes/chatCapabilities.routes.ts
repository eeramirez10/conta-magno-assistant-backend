import { uploadFilename } from '../../../infrastructure/chat/mediaSupport.js';
import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { AttachmentUnavailableError, ChatRuntime, DOCUMENT_LIMIT } from '../../../infrastructure/chat/ChatRuntime.js';
import { requiredAdminAuth } from '../middlewares/requiredAdminAuth.js';
import type { AuthApplicationService } from '../../../application/services/AuthApplicationService.js';

export function chatCapabilitiesRouter(runtime: ChatRuntime, auth: AuthApplicationService) {
  const router = Router();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: DOCUMENT_LIMIT, files: 5, fields: 4 } });
  const wrap = (fn: any) => (req: any, res: any, next: any) => Promise.resolve(fn(req,res)).catch(next);
  router.use('/chat-files', rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false }));
  router.get('/chat-files/:token', wrap(async (req: any,res: any) => {
    const link = await runtime.resolveLink(req.params.token);
    res.setHeader('Cache-Control','no-store'); res.setHeader('Referrer-Policy','no-referrer');
    if (link.mode === 'UPLOAD') {
      res.type('html').send('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width"><title>Enviar archivo a Conta Magno</title><body><h1>Enviar archivo a Conta Magno</h1><p>Imágenes, PDF, Word, Excel, CSV o XML. Máximo 16 MB (imágenes: 5 MB). El enlace permite una entrega.</p><form method="post" enctype="multipart/form-data"><input name="file" type="file" required accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.csv,.xml,.txt"><button>Enviar archivo</button></form></body></html>'); return;
    }
    const content = await runtime.attachmentContent(link.attachmentId!,false);
    res.attachment(uploadFilename(content.name,content.mime)).type(content.mime).send(content.bytes);
  }));
  router.post('/chat-files/:token', upload.single('file'), wrap(async(req: any,res: any) => {
    if (!req.file) throw new Error('Selecciona un archivo');
    await runtime.receiveUpload(req.params.token, req.file);
    res.type('html').send('<html lang="es"><title>Archivo recibido</title><h1>Archivo recibido</h1><p>Conta Magno podrá revisarlo en tu conversación.</p></html>');
  }));
  router.use(['/api/conversations','/api/attachments','/api/chat-policies'], requiredAdminAuth(auth));
  router.post('/api/conversations/:id/messages/:messageId/review-delivery', wrap(async(req:any,res:any)=>{ const message=await prisma.message.findFirstOrThrow({where:{id:req.params.messageId,conversationId:req.params.id,direction:'OUT'}}); await prisma.message.update({where:{id:message.id},data:{rawPayload:{...(message.rawPayload as object),deliveryStatus:'REVIEWED'}}});res.json({ok:true}); }));
  router.get('/api/conversations/:id/capabilities', wrap(async(req: any,res: any) => res.json({ ok: true, data: await runtime.state(req.params.id) })));
  router.post('/api/conversations/:id/take-control', wrap(async(req: any,res: any) => res.json({ ok: true, data: await runtime.take(req.params.id) })));
  router.post('/api/conversations/:id/release-control', wrap(async(req: any,res: any) => { await runtime.release(req.params.id, String(req.body.controlSessionId)); res.json({ ok: true, data: await runtime.state(req.params.id) }); }));
  router.post('/api/conversations/:id/activity', wrap(async(req: any,res: any) => res.json({ ok: true, data: await runtime.activity(req.params.id, String(req.body.controlSessionId)) })));
  router.post('/api/conversations/:id/attachments', upload.array('files',5), wrap(async(req: any,res: any) => {
    if (!req.files?.length) throw new Error('Selecciona archivos');
    await runtime.sendFiles(req.params.id, String(req.body.controlSessionId), req.files, String(req.body.caption ?? '').slice(0,1024)); res.status(201).json({ ok: true });
  }));
  router.post('/api/conversations/:id/file-links', wrap(async(req: any,res: any) => {
    await runtime.assertControl(req.params.id, String(req.body.controlSessionId));
    res.json({ ok: true, url: await runtime.createLink(req.params.id, req.body.attachmentId) });
  }));
  router.post('/api/chat-policies/:waId', wrap(async(req: any,res: any) => { if (!/^[1-9][0-9]{7,14}$/.test(req.params.waId)) throw new Error('Número inválido'); const data=await runtime.setPolicy(req.params.waId, String(req.body.decision)); res.json({ok:true,data}); }));
  router.get('/api/chat-policies', wrap(async(_req: any,res: any) => res.json({ ok: true, items: await prisma.numberPolicy.findMany({ orderBy: { updatedAt: 'desc' } }) })));
  router.post('/api/conversations/:id/policy', wrap(async(req: any,res: any) => {
    const c = await prisma.conversation.findUniqueOrThrow({ where: { id: req.params.id }, include: { contact: true } });
    const data=await runtime.setPolicy(c.contact.waId, String(req.body.decision)); res.json({ ok: true,data });
  }));
  router.post('/api/attachments/:id/retry', wrap(async(req:any,res:any)=>res.json(await runtime.retryAttachment(req.params.id))));
  router.get('/api/attachments/:id/content', wrap(async(req: any,res: any) => {
    try {
      const playback = req.query.playback === '1';
      const content = await runtime.attachmentContent(req.params.id,playback);
      res.setHeader('Cache-Control','private, no-store'); res.setHeader('X-Content-Type-Options','nosniff');
      if (!content.mime.startsWith('image/') && !playback) res.attachment(uploadFilename(content.name,content.mime));
      res.setHeader('Content-Type',content.mime);
      res.send(content.bytes);
    } catch(error) {
      if(error instanceof AttachmentUnavailableError) {res.status(404).json({ok:false,message:error.message});return;}
      throw error;
    }
  }));
  // Guard the existing text route as well; do not let an expired tab send late messages.
  router.post('/api/conversations/:id/messages', (req,res,next) => { void runtime.assertControl(req.params.id, String(req.body.controlSessionId)).then(() => next()).catch(next); });
  return router;
}
