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

const normalizedLookup: Record<string, ContribuyenteType> = {
  pf_resico: ContribuyenteType.PF_RESICO,
  "pf resico": ContribuyenteType.PF_RESICO,
  "persona fisica - resico": ContribuyenteType.PF_RESICO,
  "persona fisica resico": ContribuyenteType.PF_RESICO,
  "resico persona fisica": ContribuyenteType.PF_RESICO,

  pf_actividad_empresarial_y_profesional: ContribuyenteType.PF_ACTIVIDAD_EMPRESARIAL_Y_PROFESIONAL,
  "pf actividad empresarial y profesional": ContribuyenteType.PF_ACTIVIDAD_EMPRESARIAL_Y_PROFESIONAL,
  "persona fisica - actividad empresarial y profesional": ContribuyenteType.PF_ACTIVIDAD_EMPRESARIAL_Y_PROFESIONAL,
  "persona fisica actividad empresarial y profesional": ContribuyenteType.PF_ACTIVIDAD_EMPRESARIAL_Y_PROFESIONAL,
  "actividad empresarial y profesional": ContribuyenteType.PF_ACTIVIDAD_EMPRESARIAL_Y_PROFESIONAL,

  pf_sueldos_y_salarios: ContribuyenteType.PF_SUELDOS_Y_SALARIOS,
  "pf sueldos y salarios": ContribuyenteType.PF_SUELDOS_Y_SALARIOS,
  "persona fisica - sueldos y salarios": ContribuyenteType.PF_SUELDOS_Y_SALARIOS,
  "persona fisica sueldos y salarios": ContribuyenteType.PF_SUELDOS_Y_SALARIOS,
  "sueldos y salarios": ContribuyenteType.PF_SUELDOS_Y_SALARIOS,

  pf_arrendamiento: ContribuyenteType.PF_ARRENDAMIENTO,
  "pf arrendamiento": ContribuyenteType.PF_ARRENDAMIENTO,
  "persona fisica - arrendamiento": ContribuyenteType.PF_ARRENDAMIENTO,
  "persona fisica arrendamiento": ContribuyenteType.PF_ARRENDAMIENTO,
  arrendamiento: ContribuyenteType.PF_ARRENDAMIENTO,

  pf_plataformas_tecnologicas: ContribuyenteType.PF_PLATAFORMAS_TECNOLOGICAS,
  "pf plataformas tecnologicas": ContribuyenteType.PF_PLATAFORMAS_TECNOLOGICAS,
  "persona fisica - plataformas tecnologicas": ContribuyenteType.PF_PLATAFORMAS_TECNOLOGICAS,
  "persona fisica plataformas tecnologicas": ContribuyenteType.PF_PLATAFORMAS_TECNOLOGICAS,
  "plataformas tecnologicas": ContribuyenteType.PF_PLATAFORMAS_TECNOLOGICAS,
  "plataformas digitales": ContribuyenteType.PF_PLATAFORMAS_TECNOLOGICAS,

  pf_otros_ingresos: ContribuyenteType.PF_OTROS_INGRESOS,
  "pf otros ingresos": ContribuyenteType.PF_OTROS_INGRESOS,
  "persona fisica - otros ingresos": ContribuyenteType.PF_OTROS_INGRESOS,
  "persona fisica otros ingresos": ContribuyenteType.PF_OTROS_INGRESOS,
  "otros ingresos": ContribuyenteType.PF_OTROS_INGRESOS,

  pm_regimen_general: ContribuyenteType.PM_REGIMEN_GENERAL,
  "pm regimen general": ContribuyenteType.PM_REGIMEN_GENERAL,
  "persona moral - regimen general": ContribuyenteType.PM_REGIMEN_GENERAL,
  "persona moral regimen general": ContribuyenteType.PM_REGIMEN_GENERAL,
  "regimen general": ContribuyenteType.PM_REGIMEN_GENERAL,

  pm_resico: ContribuyenteType.PM_RESICO,
  "pm resico": ContribuyenteType.PM_RESICO,
  "persona moral - resico": ContribuyenteType.PM_RESICO,
  "persona moral resico": ContribuyenteType.PM_RESICO,
  "resico persona moral": ContribuyenteType.PM_RESICO,

  pm_sin_fines_de_lucro: ContribuyenteType.PM_SIN_FINES_DE_LUCRO,
  "pm sin fines de lucro": ContribuyenteType.PM_SIN_FINES_DE_LUCRO,
  "persona moral - sin fines de lucro": ContribuyenteType.PM_SIN_FINES_DE_LUCRO,
  "persona moral sin fines de lucro": ContribuyenteType.PM_SIN_FINES_DE_LUCRO,
  "sin fines de lucro": ContribuyenteType.PM_SIN_FINES_DE_LUCRO,

  no_lo_se_aun: ContribuyenteType.NO_LO_SE_AUN,
  "no lo se aun": ContribuyenteType.NO_LO_SE_AUN,
  "no se aun": ContribuyenteType.NO_LO_SE_AUN,

  no_inscrito_en_hacienda: ContribuyenteType.NO_INSCRITO_EN_HACIENDA,
  "no inscrito en hacienda": ContribuyenteType.NO_INSCRITO_EN_HACIENDA,
  "no inscrito en sat": ContribuyenteType.NO_INSCRITO_EN_HACIENDA,
  "no dado de alta en hacienda": ContribuyenteType.NO_INSCRITO_EN_HACIENDA,
  "no dado de alta en sat": ContribuyenteType.NO_INSCRITO_EN_HACIENDA,
  "no estoy dado de alta en hacienda": ContribuyenteType.NO_INSCRITO_EN_HACIENDA,
  "no estoy dado de alta en sat": ContribuyenteType.NO_INSCRITO_EN_HACIENDA,
  "no estoy dado de alta": ContribuyenteType.NO_INSCRITO_EN_HACIENDA,
  "aun no estoy dado de alta": ContribuyenteType.NO_INSCRITO_EN_HACIENDA,
  "todavia no estoy dado de alta": ContribuyenteType.NO_INSCRITO_EN_HACIENDA,
  "no tengo rfc": ContribuyenteType.NO_INSCRITO_EN_HACIENDA,
  "sin rfc": ContribuyenteType.NO_INSCRITO_EN_HACIENDA
};

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

export function parseContribuyenteType(value: string): ContribuyenteType | null {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[áàäâ]/g, "a")
    .replace(/[éèëê]/g, "e")
    .replace(/[íìïî]/g, "i")
    .replace(/[óòöô]/g, "o")
    .replace(/[úùüû]/g, "u")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const underscored = normalized.replace(/\s+/g, "_");

  return normalizedLookup[normalized] ?? normalizedLookup[underscored] ?? null;
}
