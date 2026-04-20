export class InquiryDomainService {
  public recommendPlan(input: {
    urgency?: string | null;
    mainNeed?: string | null;
    specialtyProfile?: string | null;
  }): "BASICO" | "INTERMEDIO" | "PREMIUM" {
    const need = (input.mainNeed || "").toLowerCase();
    const specialty = (input.specialtyProfile || "").toLowerCase();

    if (need.includes("estrategia") || specialty.includes("trader") || specialty.includes("dolares")) {
      return "PREMIUM";
    }

    if (need.includes("revision") || need.includes("optimiz")) {
      return "INTERMEDIO";
    }

    return "BASICO";
  }

  public generateFolio(now: Date, seq: number): string {
    const y = now.getUTCFullYear();
    const m = `${now.getUTCMonth() + 1}`.padStart(2, "0");
    return `CM-${y}${m}-${`${seq}`.padStart(6, "0")}`;
  }
}
