export enum ContribuyenteType {
  PF_RESICO = "PF_RESICO",
  PF_ACTIVIDAD_EMPRESARIAL_Y_PROFESIONAL = "PF_ACTIVIDAD_EMPRESARIAL_Y_PROFESIONAL",
  PF_SUELDOS_Y_SALARIOS = "PF_SUELDOS_Y_SALARIOS",
  PF_ARRENDAMIENTO = "PF_ARRENDAMIENTO",
  PF_PLATAFORMAS_TECNOLOGICAS = "PF_PLATAFORMAS_TECNOLOGICAS",
  PF_OTROS_INGRESOS = "PF_OTROS_INGRESOS",
  PM_REGIMEN_GENERAL = "PM_REGIMEN_GENERAL",
  PM_RESICO = "PM_RESICO",
  PM_SIN_FINES_DE_LUCRO = "PM_SIN_FINES_DE_LUCRO",
  NO_LO_SE_AUN = "NO_LO_SE_AUN",
  NO_INSCRITO_EN_HACIENDA = "NO_INSCRITO_EN_HACIENDA"
}

export const CONTRIBUYENTE_TYPE_VALUES = Object.values(ContribuyenteType);

export const CONTRIBUYENTE_TYPE_OPTIONS: Array<{ code: ContribuyenteType; label: string }> = [
  { code: ContribuyenteType.PF_RESICO, label: "Persona Fisica - RESICO" },
  { code: ContribuyenteType.PF_ACTIVIDAD_EMPRESARIAL_Y_PROFESIONAL, label: "Persona Fisica - Actividad Empresarial y Profesional" },
  { code: ContribuyenteType.PF_SUELDOS_Y_SALARIOS, label: "Persona Fisica - Sueldos y Salarios" },
  { code: ContribuyenteType.PF_ARRENDAMIENTO, label: "Persona Fisica - Arrendamiento" },
  { code: ContribuyenteType.PF_PLATAFORMAS_TECNOLOGICAS, label: "Persona Fisica - Plataformas Tecnologicas" },
  { code: ContribuyenteType.PF_OTROS_INGRESOS, label: "Persona Fisica - Otros Ingresos" },
  { code: ContribuyenteType.PM_REGIMEN_GENERAL, label: "Persona Moral - Regimen General" },
  { code: ContribuyenteType.PM_RESICO, label: "Persona Moral - RESICO" },
  { code: ContribuyenteType.PM_SIN_FINES_DE_LUCRO, label: "Persona Moral - Sin Fines de Lucro" },
  { code: ContribuyenteType.NO_LO_SE_AUN, label: "No lo se aun" },
  { code: ContribuyenteType.NO_INSCRITO_EN_HACIENDA, label: "No inscrito en Hacienda/SAT (sin RFC)" }
];

// Validate the model's structured code; never classify natural-language messages here.
export function parseContribuyenteType(value: string): ContribuyenteType | null {
  return CONTRIBUYENTE_TYPE_VALUES.find((code) => code === value) ?? null;
}
