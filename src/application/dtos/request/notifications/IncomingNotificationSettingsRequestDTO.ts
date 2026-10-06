import { IncomingNotificationSettings } from "../../../../domain/repositories/IIncomingNotificationRepository.js";
import { RequestValidator, ValidationTuple } from "../tools/_base.js";

export function normalizeNotificationPhone(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("521") && digits.length === 13) digits = `52${digits.slice(3)}`;
  return digits;
}

export class IncomingNotificationSettingsRequestDTO {
  public static validate(payload: unknown): ValidationTuple<IncomingNotificationSettings> {
    if (!RequestValidator.isObject(payload) || typeof payload.enabled !== "boolean" || !Array.isArray(payload.recipients)) {
      return ["enabled debe ser booleano y recipients debe ser una lista de números"];
    }
    if (payload.recipients.length > 10) return ["Puedes configurar hasta 10 números destinatarios"];
    const recipients: string[] = [];
    for (const value of payload.recipients) {
      if (typeof value !== "string" || !/^\+?[\d\s().-]+$/.test(value.trim())) {
        return ["Cada destinatario debe ser un número de WhatsApp con código de país"];
      }
      const phone = normalizeNotificationPhone(value);
      if (!/^[1-9]\d{7,14}$/.test(phone)) return ["Los números deben incluir el código de país y tener entre 8 y 15 dígitos"];
      if (!recipients.includes(phone)) recipients.push(phone);
    }
    const templateName = typeof payload.templateName === "string" ? payload.templateName.trim() : "";
    const languageCode = typeof payload.languageCode === "string" ? payload.languageCode.trim() : "";
    const templateMode = payload.templateMode ?? "INCOMING_MESSAGE";
    if (templateMode !== "INCOMING_MESSAGE" && templateMode !== "OWNER_LEAD") return ["Elige una plantilla propia o la plantilla actual de solicitudes"];
    if (!/^[a-z0-9_]{1,512}$/.test(templateName)) return ["El nombre de plantilla debe usar minúsculas, números y guiones bajos"];
    if (!/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(languageCode)) return ["El idioma debe tener un código válido, por ejemplo es_MX o es"];
    if (payload.enabled && recipients.length === 0) return ["Añade al menos un número antes de activar las notificaciones"];
    return [undefined, { enabled: payload.enabled, recipients, templateName, languageCode, templateMode }];
  }
}
