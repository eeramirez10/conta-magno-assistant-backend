import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ResponsesClient, type HistoryMessage } from "../infrastructure/integrations/openai/ResponsesClient.js";
import type { AssistantStructuredOutput } from "../infrastructure/integrations/openai/responseOutput.js";
import { contaMagnoAssistantPrompt } from "../application/prompts/contaMagnoAssistantPrompt.js";
import { contaMagnoCommercialCatalog, normalizeRecommendation, qualificationClosingMessage, cfoQualificationClosingMessage } from "../application/catalog/contaMagnoCommercialCatalog.js";
import { Env } from "../infrastructure/config/env.js";
import { logger } from "../infrastructure/logging/logger.js";

// Real Responses, synthetic leads only. No database, notification or WhatsApp imports.
const trace: Array<Record<string, unknown>> = [];
type Step = { user: string; check?: (output: AssistantStructuredOutput) => void };
const contains = (output: AssistantStructuredOutput, pattern: RegExp) => assert.match(output.replyText, pattern);
const recommendation = (output: AssistantStructuredOutput, name: string) => assert.equal(normalizeRecommendation(output.extractedFields.recommendedPlan ?? ""), name);
const asksName = (output: AssistantStructuredOutput) => {
  contains(output, /nombre/i);
  assert.doesNotMatch(output.replyText, /correo|electr[oó]nico|whatsapp/i);
};
const asksEmail = (output: AssistantStructuredOutput) => {
  contains(output, /correo|electr[oó]nico/i);
  assert.doesNotMatch(output.replyText, /whatsapp/i);
};
const asksWhatsApp = (output: AssistantStructuredOutput) => contains(output, /n[uú]mero.*whatsapp|whatsapp.*correcto/i);
const completed = (output: AssistantStructuredOutput) => {
  assert.equal(output.nextStage, "COMPLETED");
  assert.equal(output.replyText, qualificationClosingMessage);
};
const completedCfo = (output: AssistantStructuredOutput) => {
  assert.equal(output.nextStage, "COMPLETED");
  assert.equal(output.replyText, cfoQualificationClosingMessage);
};
const cfoPrice = (packageName: string, monthlyFee: RegExp) => (output: AssistantStructuredOutput) => {
  recommendation(output, "CFO Externo");
  contains(output, monthlyFee);
  contains(output, /IVA/);
  contains(output, /referencia|referencial|sugerid|propuesta|definitiv/i);
  contains(output, /diagn[oó]stico/i);
  contains(output, /llamada/i);
  assert.doesNotMatch(output.replyText, /\$(?:12[,.]?000|22[,.]?000|35[,.]?000)/);
  if (packageName === "CFO Esencial") contains(output, /15[,.]?000/);
  if (packageName === "CFO Estratégico") {
    contains(output, /7[,.]?500/);
    contains(output, /(?:seis|6) meses/i);
    contains(output, /posibilidad|posible|podr[ií]a|puede|sujet|confirm/i);
  }
  if (packageName === "CFO Integral") {
    contains(output, /inclui|incluy/i);
    contains(output, /(?:seis|6) meses/i);
  }
  const normalized = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  assert.ok(normalized(output.replyText).includes(normalized(packageName)), "La respuesta debe identificar el paquete CFO recomendado");
  assert.ok(normalized(output.extractedFields.specialtyProfile ?? "").includes(normalized(packageName.replace(/^CFO /, ""))), "El perfil debe conservar el nivel CFO recomendado");
  assert.equal(output.extractedFields.budgetRange, undefined);
};

async function scenario(client: ResponsesClient, name: string, steps: Step[]): Promise<void> {
  const scenarioFilter = process.env.RESPONSES_QUALIFICATION_FILTER;
  if (scenarioFilter && !new RegExp(scenarioFilter, "i").test(name)) return;
  let remoteId: string | null = null;
  const history: HistoryMessage[] = [];
  const contact: Record<string, unknown> = { id: "synthetic_contact", waId: "525500000000", phoneE164: "525500000000", fullName: "Prospecto Conta Magno", email: null };
  const inquiry: Record<string, unknown> = { id: "synthetic_inquiry", folio: "CM-SYNTHETIC", status: "NEW", recommendedPlan: null };
  const conversation = { id: "synthetic_conversation", stage: "GREETING", flowCompleted: false };
  try {
    for (const [index, step] of steps.entries()) {
      history.push({ id: `user_${index}`, direction: "IN", text: step.user, openAiSyncedAt: null });
      remoteId = await client.syncHistory({
        conversationId: remoteId, messages: history,
        onConversationCreated: async (id) => { remoteId = id; },
        onMessagesSynced: async (ids, at) => { for (const message of history) if (ids.includes(message.id)) message.openAiSyncedAt = at; },
        shouldContinue: async () => true
      });
      const calls: string[] = [];
      const result = await client.runResponse({
        conversationId: remoteId, prompt: contaMagnoAssistantPrompt,
        contextJson: { business: "Conta Magno", timezone: "America/Mexico_City", contact, inquiry, conversation, commercialCatalog: contaMagnoCommercialCatalog },
        shouldContinue: async () => true,
        onToolCall: async (call) => { calls.push(call.name); return { ok: false, error: "Prueba aislada: devuelve los datos mediante extractedFields, sin efectos externos." }; }
      });
      const output = result.output;
      trace.push({ scenario: name, turn: index + 1, user: step.user, responseId: result.responseId, output, calls });
      assert.ok(!calls.some((call) => ["listAvailableSlots", "createTentativeAppointment"].includes(call)), "No se permiten funciones de agenda");
      assert.equal(output.extractedFields.preferredDate, undefined);
      assert.equal(output.extractedFields.preferredTime, undefined);
      assert.ok((output.replyText.match(/\?/g) ?? []).length <= 1, "Solo una pregunta por mensaje");
      step.check?.(output);
      if (!conversation.flowCompleted) {
        const fields = output.extractedFields;
        for (const key of ["clientType", "specialtyProfile", "mainNeed", "urgency", "budgetRange", "recommendedPlan"] as const) {
          if (fields[key] !== undefined) inquiry[key] = key === "recommendedPlan" ? normalizeRecommendation(fields[key]) : fields[key];
        }
        if (fields.fullName) contact.fullName = fields.fullName;
        if (fields.email) contact.email = fields.email;
        if (fields.phoneWhatsApp) contact.phoneE164 = fields.phoneWhatsApp;
      }
      conversation.stage = output.nextStage;
      if (output.nextStage === "COMPLETED") { conversation.flowCompleted = true; inquiry.status = "CLOSED"; }
      history.push({ id: `assistant_${index}`, direction: "OUT", text: output.replyText, openAiSyncedAt: result.syncedAt });
    }
    logger.info({ scenario: name, turns: steps.length }, "Calificación sintética validada");
  } finally {
    if (remoteId) await client.deleteConversation(remoteId);
  }
}

async function main(): Promise<void> {
  if (!Env.openAiApiKey) throw new Error("Falta OPENAI_API_KEY");
  const artifactDirectory = await mkdtemp(join(tmpdir(), "conta-magno-qualification-"));
  const client = new ResponsesClient();
  try {
    await scenario(client, "PF habitual, régimen desconocido y seguimiento", [
      { user: "Soy persona física y vendo artesanías. Busco únicamente declaraciones mensuales y cumplimiento fiscal, con soporte básico.", check: (o) => { recommendation(o, "Básico"); contains(o, /800/); contains(o, /1[,.]?000/); assert.equal(o.extractedFields.clientType, undefined); } },
      { user: "Sí, me interesa avanzar.", check: asksName },
      { user: "Lucía Prueba Sintética", check: asksEmail },
      { user: "lucia.sintetica@example.com", check: asksWhatsApp },
      { user: "Sí, este WhatsApp es correcto.", check: (o) => contains(o, /contribuyente|r[eé]gimen/i) },
      { user: "No lo sé aún.", check: (o) => { completed(o); assert.equal(o.extractedFields.clientType, "NO_LO_SE_AUN"); } },
      { user: "¿El paquete incluye declaraciones mensuales?", check: (o) => { assert.equal(o.nextStage, "COMPLETED"); contains(o, /declaraciones mensuales/i); assert.doesNotMatch(o.replyText, /nombre completo|correo electr[oó]nico/i); } }
    ]);
    await scenario(client, "PF paquete Intermedio", [
      { user: "Soy persona física RESICO y tengo una papelería. Necesito declaraciones, asesoría mensual, revisión de gastos y optimización fiscal básica, sin planeación fiscal avanzada.", check: (o) => { recommendation(o, "Intermedio"); contains(o, /1[,.]?200/); contains(o, /1[,.]?500/); } }
    ]);
    await scenario(client, "PF paquete Premium", [
      { user: "Soy persona física con un pequeño negocio de servicios de diseño. Necesito contabilidad mensual, planeación fiscal, estrategia financiera y acompañamiento personalizado dentro del paquete contable; no busco dirección financiera externa.", check: (o) => { recommendation(o, "Premium"); contains(o, /1[,.]?800/); contains(o, /2[,.]?500/); } }
    ]);
    await scenario(client, "Declaración anual puntual", [
      { user: "Soy asalariado y solo necesito mi declaración anual. No requiero contabilidad mensual.", check: (o) => { recommendation(o, "Asesoría fiscal"); contains(o, /cotiza|contador/i); assert.doesNotMatch(o.replyText, /paquete (b[aá]sico|intermedio|premium)/i); } }
    ]);
    await scenario(client, "Captura sin RFC", [
      { user: "Vendo artesanías por mi cuenta, no tengo RFC y necesito apoyo para registrarme y regularizarme. Solo busco asesoría fiscal puntual.", check: (o) => { assert.equal(o.extractedFields.clientType, "NO_INSCRITO_EN_HACIENDA"); contains(o, /cotiza|contador/i); } },
      { user: "Sí, me interesa avanzar.", check: asksName },
      { user: "Mario Prueba Sintética", check: asksEmail },
      { user: "mario.sintetico@example.com", check: asksWhatsApp },
      { user: "Sí, este número es correcto.", check: completed }
    ]);
    await scenario(client, "CFO para PF con negocio, datos completos y captura", [
      { user: "Soy persona física y tengo un restaurante con 18 empleados. Tengo contador externo pero necesito un CFO externo para rentabilidad y flujo de efectivo.", check: cfoPrice("CFO Estratégico", /15[,.]?000/) },
      { user: "Sí, me interesa coordinar la llamada inicial para revisar la propuesta.", check: asksName },
      { user: "Ana Prueba Sintética", check: asksEmail },
      { user: "ana.sintetica@example.com", check: asksWhatsApp },
      { user: "Sí, este es mi WhatsApp.", check: (o) => contains(o, /contribuyente|r[eé]gimen/i) },
      { user: "Persona Física - Actividad Empresarial y Profesional", check: completedCfo }
    ]);
    await scenario(client, "CFO empresa, preguntas individuales y presupuesto expreso", [
      { user: "Somos una empresa y necesitamos dirección financiera externa porque no controlamos el flujo de efectivo.", check: (o) => contains(o, /giro|actividad|dedica/i) },
      { user: "Distribuimos alimentos.", check: (o) => contains(o, /tama[ñn]o|empleados|ingresos|factura/i) },
      { user: "Tenemos 40 empleados.", check: (o) => contains(o, /contab|contador/i) },
      { user: "Sí, tenemos equipo contable interno.", check: cfoPrice("CFO Estratégico", /15[,.]?000/) },
      { user: "Me interesa y tengo un presupuesto de 50,000 pesos mensuales.", check: (o) => { asksName(o); assert.match(o.extractedFields.budgetRange ?? "", /50[,.]?000/); } }
    ]);
    await scenario(client, "CFO Esencial", [
      { user: "Tengo una pequeña papelería con 3 empleados y contador externo. Busco CFO externo: necesito análisis de estados financieros, indicadores, tablero de KPIs y un reporte financiero mensual.", check: cfoPrice("CFO Esencial", /8[,.]?000/) }
    ]);
    await scenario(client, "CFO Integral", [
      { user: "Somos una empresa mediana de manufactura con 80 empleados y equipo contable interno. No tenemos planeación financiera estratégica y la dirección necesita apoyo para evaluar decisiones de inversión. Buscamos CFO externo para acompañamiento a la dirección y supervisión del equipo financiero con seguimiento semanal.", check: cfoPrice("CFO Integral", /25[,.]?000/) }
    ]);
    await scenario(client, "Entregables CFO y periodicidades", [
      { user: "¿Cuáles son los nueve entregables generales de CFO Externo y sus periodicidades? Quiero la lista completa, y saber si todos están incluidos en cualquier paquete.", check: (o) => {
        for (const pattern of [/dashboard/i, /resultados gerencial/i, /flujo de efectivo/i, /presupuesto/i, /cuentas por cobrar/i, /cuentas por pagar/i, /rentabilidad/i, /indicadores financieros|KPIs/i, /informe ejecutivo/i, /semanal o mensual/i, /mensual o trimestral/i, /propuesta/i]) contains(o, pattern);
        assert.doesNotMatch(o.replyText, /todos (est[aá]n|vienen) incluidos en (cada|cualquier|todos)/i);
      } }
    ]);
    await scenario(client, "Diagnóstico CFO y condiciones comerciales", [
      { user: "¿Cuánto cuesta el diagnóstico financiero y cómo se cobra en cada paquete CFO? Explícame las condiciones de bonificación e inclusión.", check: (o) => {
        for (const pattern of [/15[,.]?000/, /7[,.]?500/, /IVA/i, /esencial/i, /estrat[eé]gico/i, /integral/i, /(?:seis|6) meses/i, /separado/i, /posibilidad|posible|podr[ií]a|puede/i]) contains(o, pattern);
      } },
      { user: "Si elijo Estratégico por seis meses, ¿me garantizas la bonificación automática?", check: (o) => contains(o, /no.{0,60}(garanti|autom[aá]tic)|posibilidad|sujet|confirm/i) },
      { user: "¿Puedo tener incluido el diagnóstico en Integral sin contratar los seis meses?", check: (o) => { contains(o, /(?:seis|6) meses/i); contains(o, /no|condici[oó]n|requiere/i); } }
    ]);
    await scenario(client, "Metodología CFO", [
      { user: "¿Cuáles son las cuatro etapas de la metodología CFO y cómo cambia el seguimiento por paquete?", check: (o) => {
        for (const pattern of [/diagn[oó]stico inicial/i, /planeaci[oó]n/i, /implementaci[oó]n de indicadores/i, /seguimiento financiero mensual/i, /evaluaci[oó]n estrat[eé]gica/i, /quincenal/i, /semanal/i]) contains(o, pattern);
      } }
    ]);
    await scenario(client, "Exclusiones CFO", [
      { user: "Dime la lista completa de servicios que se cotizan por separado de CFO. ¿La supervisión del equipo y el análisis de decisiones de inversión de Integral cubren también esos servicios?", check: (o) => {
        for (const pattern of [/contabilidad operativa/i, /declaraciones fiscales/i, /n[oó]mina/i, /auditor[ií]as/i, /cobranza directa/i, /ejecuci[oó]n de pagos/i, /tr[aá]mites legales/i, /licencias de software/i, /implementaciones tecnol[oó]gicas complejas/i, /estudios especializados de inversi[oó]n/i, /cotiza|separado/i]) contains(o, pattern);
      } }
    ]);
    await scenario(client, "Llamada inicial sin agenda automática", [
      { user: "¿Puedo reservar una llamada de diagnóstico inicial de CFO mañana a las 10?", check: (o) => { contains(o, /chat/i); contains(o, /coordina|equipo|responsable/i); assert.doesNotMatch(o.replyText, /cita (confirmada|reservada)|te (agendo|reservo)/i); } },
      { user: "Si acepto esa llamada inicial, ¿ya estoy contratando el diagnóstico financiero de 15,000 pesos?", check: (o) => { contains(o, /no|distint|separad|diferent/i); assert.doesNotMatch(o.replyText, /llamada (gratuita|sin costo)/i); } }
    ]);
    assert.ok(trace.length > 0, "El filtro no seleccionó ninguna conversación sintética");
  } finally {
    const artifactPath = join(artifactDirectory, "conversations.json");
    await writeFile(artifactPath, JSON.stringify(trace, null, 2));
    logger.info({ artifactPath, turns: trace.length }, "Conversaciones sintéticas guardadas; sin WhatsApp ni base de datos");
  }
}

main().catch((error: unknown) => {
  logger.error({ errorType: error instanceof Error ? error.name : "Unknown", detail: error instanceof assert.AssertionError ? error.message : undefined }, "Falló la calificación sintética; revisa el registro generado o las credenciales, el modelo y la conectividad");
  process.exitCode = 1;
});
