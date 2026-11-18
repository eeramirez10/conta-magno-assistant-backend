import OpenAI from 'openai';
export function transcriptionModel(value = process.env.OPENAI_TRANSCRIPTION_MODEL): string {
 const setting = value?.trim();
 return !setting || ['OPENAI_TRANSCRIPTION_MODEL','$OPENAI_TRANSCRIPTION_MODEL','${OPENAI_TRANSCRIPTION_MODEL}'].includes(setting) ? 'gpt-transcribe' : setting;
}
const extensions: Record<string,string> = {'application/pdf':'pdf','image/png':'png','image/jpeg':'jpg','image/webp':'webp','application/msword':'doc','application/vnd.ms-excel':'xls','application/vnd.openxmlformats-officedocument.wordprocessingml.document':'docx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'xlsx','application/xml':'xml','text/csv':'csv','text/plain':'txt'};
export function uploadFilename(name: string, mime: string): string {
 const extension=extensions[mime];
 return !extension || name.toLowerCase().endsWith(`.${extension}`) ? name : `${name}.${extension}`;
}
export function mediaError(error: unknown): string {
 if (error instanceof OpenAI.APIError) {
  if(error.status===404) return 'OpenAI no pudo acceder al archivo o al modelo configurado. Revisa OPENAI_MODEL y OPENAI_TRANSCRIPTION_MODEL y reintenta.';
  return `No se pudo completar la lectura con OpenAI (HTTP ${error.status ?? 'desconocido'}). Reintenta el archivo.`;
 }
 return error instanceof Error ? error.message : 'No se pudo procesar el archivo';
}
export function trustedMediaUrl(value: string): URL {
 const url=new URL(value);
 if(url.protocol!=='https:' || url.username || url.password || !['facebook.com','fbcdn.net','fbsbx.com','whatsapp.net'].some(domain=>url.hostname===domain || url.hostname.endsWith(`.${domain}`))) throw new Error('Meta devolvió una URL de medios no permitida');
 return url;
}
export function blockFailure(result: any): string | null {
 const failures=result.block_users?.failed_users ?? result.unblock_users?.failed_users ?? [];
 if (!failures.length && result.success !== false) return null;
 const error=failures[0]?.errors?.[0] ?? failures[0]?.error ?? result.error;
 const code=error?.error_code ?? error?.code;
 const message=error?.error_message ?? error?.message;
 return `Meta no confirmó la operación${code ? ` (código ${code})` : ''}${typeof message==='string' ? `: ${message.slice(0,400)}` : '. Puede requerir una interacción reciente o permisos adicionales.'}`;
}
