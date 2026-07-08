-- CreateEnum
CREATE TYPE "ContribuyenteType" AS ENUM (
  'PF_RESICO',
  'PF_ACTIVIDAD_EMPRESARIAL_Y_PROFESIONAL',
  'PF_SUELDOS_Y_SALARIOS',
  'PF_ARRENDAMIENTO',
  'PF_PLATAFORMAS_TECNOLOGICAS',
  'PF_OTROS_INGRESOS',
  'PM_REGIMEN_GENERAL',
  'PM_RESICO',
  'PM_SIN_FINES_DE_LUCRO',
  'NO_LO_SE_AUN'
);

-- Migrate old text values into enum values
ALTER TABLE "Inquiry" ADD COLUMN "clientType_new" "ContribuyenteType";

WITH normalized AS (
  SELECT
    "id",
    regexp_replace(
      lower(
        replace(replace(replace(replace(replace(replace(trim(coalesce("clientType", '')), 'á', 'a'), 'é', 'e'), 'í', 'i'), 'ó', 'o'), 'ú', 'u'), 'ü', 'u')
      ),
      '[^a-z0-9]+',
      ' ',
      'g'
    ) AS norm
  FROM "Inquiry"
)
UPDATE "Inquiry" i
SET "clientType_new" = CASE
  WHEN n.norm = '' THEN NULL

  WHEN n.norm IN ('pf resico', 'persona fisica resico', 'resico persona fisica') THEN 'PF_RESICO'::"ContribuyenteType"
  WHEN n.norm IN (
    'pf actividad empresarial y profesional',
    'persona fisica actividad empresarial y profesional',
    'actividad empresarial y profesional'
  ) THEN 'PF_ACTIVIDAD_EMPRESARIAL_Y_PROFESIONAL'::"ContribuyenteType"
  WHEN n.norm IN ('pf sueldos y salarios', 'persona fisica sueldos y salarios', 'sueldos y salarios') THEN 'PF_SUELDOS_Y_SALARIOS'::"ContribuyenteType"
  WHEN n.norm IN ('pf arrendamiento', 'persona fisica arrendamiento', 'arrendamiento') THEN 'PF_ARRENDAMIENTO'::"ContribuyenteType"
  WHEN n.norm IN (
    'pf plataformas tecnologicas',
    'persona fisica plataformas tecnologicas',
    'plataformas tecnologicas',
    'plataformas digitales'
  ) THEN 'PF_PLATAFORMAS_TECNOLOGICAS'::"ContribuyenteType"
  WHEN n.norm IN ('pf otros ingresos', 'persona fisica otros ingresos', 'otros ingresos') THEN 'PF_OTROS_INGRESOS'::"ContribuyenteType"

  WHEN n.norm IN ('pm regimen general', 'persona moral regimen general', 'regimen general') THEN 'PM_REGIMEN_GENERAL'::"ContribuyenteType"
  WHEN n.norm IN ('pm resico', 'persona moral resico', 'resico persona moral') THEN 'PM_RESICO'::"ContribuyenteType"
  WHEN n.norm IN ('pm sin fines de lucro', 'persona moral sin fines de lucro', 'sin fines de lucro') THEN 'PM_SIN_FINES_DE_LUCRO'::"ContribuyenteType"

  WHEN n.norm IN ('no lo se aun', 'no se aun', 'indefinido') THEN 'NO_LO_SE_AUN'::"ContribuyenteType"
  ELSE NULL
END
FROM normalized n
WHERE i."id" = n."id";

ALTER TABLE "Inquiry" DROP COLUMN "clientType";
ALTER TABLE "Inquiry" RENAME COLUMN "clientType_new" TO "clientType";
