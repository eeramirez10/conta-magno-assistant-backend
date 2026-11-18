import assert from "node:assert/strict";
import test from "node:test";
import { fixture, response, finalOutput } from "./helpers.js";
import { ConversationStage } from "../src/domain/enums/ConversationStage.js";
import { InquiryStatus } from "../src/domain/enums/InquiryStatus.js";
import { UpdateInquiryFieldsRequestDTO } from "../src/application/dtos/request/tools/UpdateInquiryFieldsRequestDTO.js";
import { UpdateConversationStageRequestDTO } from "../src/application/dtos/request/tools/UpdateConversationStageRequestDTO.js";
import { contaMagnoCommercialCatalog } from "../src/application/catalog/contaMagnoCommercialCatalog.js";
import { contaMagnoAssistantFunctions } from "../src/infrastructure/integrations/openai/assistantTools.js";
import { assistantOutputFormat } from "../src/infrastructure/integrations/openai/responseOutput.js";

test("partial saves never infer a package from missing data or financial keywords", async () => {
  for (const fields of [{}, { mainNeed: "Estrategia financiera", specialtyProfile: "Trader que recibe dólares" }, { mainNeed: "Revisión y optimización fiscal" }]) {
    const f = fixture(); f.inquiry.recommendedPlan = null;
    const [error, dto] = UpdateInquiryFieldsRequestDTO.validate({ inquiryId: f.inquiry.id, ...fields });
    assert.ifError(error);
    const saved = await f.inquiryService.updateFields(dto!);
    assert.equal(saved.recommendedPlan, null);
    assert.equal(f.effects.fieldUpdates, 1);
  }
});

test("explicit CFO recommendation is readable in storage and update notification and survives partial saves", async () => {
  const f = fixture(); f.inquiry.recommendedPlan = null;
  const context = { waId: f.contact.waId, conversationId: f.conversation.id, inquiryId: f.inquiry.id, folio: f.inquiry.folio };
  assert.equal((await f.router.executeNativeTool({ name: "updateInquiryFields", arguments: { recommendedPlan: "CFO_EXTERNO", mainNeed: "Dirección financiera" } }, context)).ok, true);
  assert.equal(f.inquiry.recommendedPlan, "CFO Externo");
  assert.match(f.updatedNotificationPayloads[0].summary, /plan: CFO Externo/);
  await f.router.executeNativeTool({ name: "updateInquiryFields", arguments: { specialtyProfile: "Negocio de servicios, 20 empleados, equipo contable propio" } }, context);
  assert.equal(f.inquiry.recommendedPlan, "CFO Externo");
});

test("CFO completion notifies once and subsequent questions cannot mutate the closed lead", async () => {
  const f = fixture(); f.inquiry.recommendedPlan = null;
  f.remote.setGeneration(async () => response(finalOutput("COMPLETED", {
    clientType: "NO_LO_SE_AUN", mainNeed: "Flujo de efectivo y dirección financiera", recommendedPlan: "CFO Externo",
    specialtyProfile: "Persona física con comercio, 12 empleados, contador externo; le interesa avanzar con la inversión de referencia"
  })));
  await f.orchestrator.processIncoming(f.provider, f.incoming("complete_cfo"));
  assert.equal(f.inquiry.status, InquiryStatus.CLOSED);
  assert.equal(f.inquiry.recommendedPlan, "CFO Externo");
  assert.equal(f.inquiry.budgetRange, undefined);
  assert.equal(f.ownerTemplatePayloads[0].recommendedPlan, "CFO Externo");
  const updates = f.effects.fieldUpdates;
  f.remote.setGeneration(async () => response(finalOutput("COMPLETED", { recommendedPlan: "Premium", budgetRange: "$30,000" })));
  await f.orchestrator.processIncoming(f.provider, f.incoming("followup_cfo"));
  assert.equal(f.inquiry.recommendedPlan, "CFO Externo");
  assert.equal(f.effects.fieldUpdates, updates);
  assert.equal(f.effects.ownerTemplates, 1);
  assert.equal(f.effects.createdInquiries, 1);
});

test("unknown regime and no RFC both allow completing capture without fabricated regimes", async () => {
  for (const [message, clientType] of [["No lo sé aún", "NO_LO_SE_AUN"], ["No tengo RFC", "NO_INSCRITO_EN_HACIENDA"]]) {
    const f = fixture();
    f.remote.setGeneration(async () => response(finalOutput("COMPLETED", { clientType })));
    await f.orchestrator.processIncoming(f.provider, f.incoming(`complete_${clientType}`, message));
    assert.equal(f.inquiry.clientType, clientType);
    assert.equal(f.inquiry.status, InquiryStatus.CLOSED);
    assert.equal(f.effects.ownerTemplates, 1);
  }
});

test("raw prospect messages never fill a classification omitted by the model", async () => {
  for (const text of ["No tengo RFC", "No estoy dado de alta en Hacienda", "No tengo RFC a la mano, pero sí estoy inscrito y pago mis impuestos"]) {
    const f = fixture(); f.inquiry.clientType = null; f.inquiry.recommendedPlan = null;
    f.remote.setGeneration(async () => response(finalOutput()));
    await f.orchestrator.processIncoming(f.provider, f.incoming("no_local_classification", text));
    assert.equal(f.inquiry.clientType, null);
    assert.equal(f.inquiry.recommendedPlan, null);
  }
});

test("qualification tools require a structured tax code instead of interpreting natural language", async () => {
  const f = fixture(); f.inquiry.clientType = null;
  const context = { waId: f.contact.waId, conversationId: f.conversation.id, inquiryId: f.inquiry.id };
  for (const clientType of ["No tengo RFC", "No lo sé aún", "Persona Física - RESICO"]) {
    const result = await f.router.executeNativeTool({ name: "updateInquiryFields", arguments: { clientType } }, context);
    assert.equal(result.ok, false);
    assert.equal(f.inquiry.clientType, null);
  }
  const result = await f.router.executeNativeTool({ name: "updateInquiryFields", arguments: { clientType: "NO_INSCRITO_EN_HACIENDA" } }, context);
  assert.equal(result.ok, true);
  assert.equal(f.inquiry.clientType, "NO_INSCRITO_EN_HACIENDA");
});

test("all agenda functions and stage writes are rejected without reaching appointment repositories", async () => {
  const f = fixture();
  const context = { waId: f.contact.waId, conversationId: f.conversation.id, inquiryId: f.inquiry.id };
  // The fixture has no appointment or slot methods; invoking either repository would throw.
  for (const name of ["listAvailableSlots", "createTentativeAppointment"]) {
    for (const status of [InquiryStatus.NEW, InquiryStatus.CLOSED]) {
      f.inquiry.status = status;
      const result = await f.router.executeNativeTool({ name, arguments: { slotId: "old_slot" } }, context);
      assert.equal(result.ok, false);
      assert.match(String(result.error), /agenda está deshabilitada/);
    }
  }
  f.inquiry.status = InquiryStatus.NEW;
  assert.equal((await f.router.executeNativeTool({ name: "updateConversationStage", arguments: { stage: "SCHEDULING" } }, context)).ok, false);
  assert.equal(f.conversation.stage, ConversationStage.GREETING);
  assert.ok(UpdateConversationStageRequestDTO.validate({ conversationId: f.conversation.id, stage: "SCHEDULING" })[0]);
  assert.ok(!assistantOutputFormat.schema.properties.nextStage.enum.includes("SCHEDULING" as never));
  const stageTool = contaMagnoAssistantFunctions.find((tool) => tool.name === "updateConversationStage")!;
  assert.ok(!JSON.stringify(stageTool).includes("SCHEDULING"));
  assert.ok(contaMagnoAssistantFunctions.every((tool) => !["listAvailableSlots", "createTentativeAppointment"].includes(tool.name)));
});

test("historical scheduling records can continue in an active qualification stage", async () => {
  const f = fixture(); f.conversation.stage = ConversationStage.SCHEDULING;
  await f.orchestrator.processIncoming(f.provider, f.incoming("continue_old_record"));
  assert.equal(f.conversation.stage, ConversationStage.QUALIFYING);
});

test("the model receives the same commercial catalog in instructions and per-turn context", async () => {
  const f = fixture();
  await f.orchestrator.processIncoming(f.provider, f.incoming("catalog"));
  const instructions = f.remote.requests[0].instructions;
  const context = JSON.parse(instructions.split("CONTEXTO_JSON:\n")[1]);
  assert.deepEqual(context.commercialCatalog, contaMagnoCommercialCatalog);
  assert.ok(instructions.split("CONTEXTO_JSON:\n")[0].includes(JSON.stringify(contaMagnoCommercialCatalog)));
});
