// Shared by the assistant instructions and the context sent on every turn.
export const contaMagnoCommercialCatalog = {
  services: {
    accounting: {
      name: "Contabilidad inteligente con IA",
      description: "Atención contable y cumplimiento fiscal con apoyo de inteligencia artificial y del equipo contable.",
      individualPackages: [
        {
          name: "Básico",
          priceRange: "$800–$1,000 MXN",
          includes: ["Declaraciones mensuales", "Cumplimiento fiscal", "Soporte básico"]
        },
        {
          name: "Intermedio",
          priceRange: "$1,200–$1,500 MXN",
          includes: ["Todo lo incluido en Básico", "Asesoría mensual", "Revisión de gastos", "Optimización fiscal básica"]
        },
        {
          name: "Premium",
          priceRange: "$1,800–$2,500 MXN",
          includes: ["Todo lo incluido en Intermedio", "Planeación fiscal", "Estrategia financiera", "Acompañamiento personalizado"]
        }
      ],
      pricingPolicy: "Conservar estos rangos sin añadir supuestos sobre IVA. Las solicitudes puntuales y los servicios fuera de paquete requieren cotización del contador. Los paquetes son para atención contable habitual de personas físicas; no asignarlos automáticamente a empresas."
    },
    externalCfo: {
      name: "CFO Externo",
      audience: "Personas físicas con negocio y empresas que necesitan dirección financiera.",
      financialTopics: ["Rentabilidad", "Márgenes", "EBITDA", "Flujo de efectivo", "Control financiero", "Estrategia de crecimiento"],
      packages: [
        {
          name: "CFO Esencial",
          suggestedMonthlyFee: "$8,000 MXN/mes más IVA",
          includes: ["Diagnóstico inicial de necesidades", "Análisis de estados financieros", "Indicadores de liquidez y rentabilidad", "Tablero de KPIs", "Reporte financiero mensual"],
          financialDiagnosisTerms: "El diagnóstico financiero se contrata por separado a su tarifa de referencia."
        },
        {
          name: "CFO Estratégico",
          suggestedMonthlyFee: "$15,000 MXN/mes más IVA",
          includes: ["Todo lo incluido en CFO Esencial", "Flujo de efectivo proyectado", "Presupuestos", "Análisis de desviaciones", "Análisis de costos y gastos", "Capital de trabajo", "Recomendaciones financieras"],
          followUp: "Quincenal",
          financialDiagnosisTerms: "Posibilidad de bonificar $7,500 del diagnóstico financiero con contrato mínimo de seis meses. La bonificación no es automática ni garantizada; se confirma en la propuesta."
        },
        {
          name: "CFO Integral",
          suggestedMonthlyFee: "$25,000 MXN/mes más IVA",
          includes: ["Todo lo incluido en CFO Estratégico", "Planeación financiera estratégica", "Acompañamiento a la dirección", "Supervisión financiera del equipo interno", "Análisis de decisiones de inversión"],
          followUp: "Semanal",
          financialDiagnosisTerms: "Diagnóstico financiero incluido con contrato mínimo de seis meses. No ofrecerlo incluido sin cumplir ese plazo; las condiciones definitivas se confirman en la propuesta."
        }
      ],
      financialDiagnosis: {
        referenceFee: "$15,000 MXN más IVA",
        policy: "Diagnóstico financiero sujeto a las condiciones del paquete y a propuesta comercial. El diagnóstico inicial de necesidades incluido en los paquetes y la llamada inicial de evaluación no equivalen a contratar este diagnóstico financiero. No sumar un cargo de implementación que no esté confirmado."
      },
      pricingPolicy: "Precios mensuales sugeridos y referenciales, sujetos a evaluación de las necesidades de cada empresa y a propuesta personalizada. No comprometer precios definitivos ni alcances adicionales. No constituyen el presupuesto declarado del prospecto.",
      methodology: ["Diagnóstico inicial", "Planeación e implementación de indicadores", "Seguimiento financiero mensual", "Evaluación estratégica periódica"],
      methodologyPolicy: "Los entregables y la frecuencia dependen del paquete contratado; respetar el seguimiento quincenal de Estratégico y semanal de Integral, además del proceso general mensual. La periodicidad de seguimiento no fija por sí sola un número de llamadas o reuniones.",
      exclusions: ["Contabilidad operativa", "Declaraciones fiscales", "Nómina", "Auditorías", "Cobranza directa", "Ejecución de pagos", "Trámites legales", "Licencias de software", "Implementaciones tecnológicas complejas", "Estudios especializados de inversión"],
      exclusionsPolicy: "Estos servicios se cotizan por separado. El análisis de decisiones de inversión de CFO Integral no incluye estudios especializados de inversión; analizar cuentas por cobrar o pagar no implica realizar cobranza ni ejecutar pagos.",
      commercialObjective: "Conseguir una llamada de diagnóstico inicial con el responsable de Conta Magno para evaluar al prospecto y preparar una propuesta personalizada. El equipo coordina la llamada por este mismo chat; el agente no reserva fechas ni horarios, no confirma una llamada agendada ni inicia llamadas. No se ha definido precio, gratuidad ni duración de esta llamada inicial.",
      qualification: ["Problema financiero", "Giro del negocio", "Tamaño del negocio", "Existencia de equipo contable", "Interés en la inversión de referencia"],
      deliverables: [
        { name: "Dashboard financiero ejecutivo", content: "Indicadores de liquidez, rentabilidad, endeudamiento y capital de trabajo", frequency: "Mensual" },
        { name: "Estado de resultados gerencial", content: "Análisis de ingresos, costos, gastos y utilidad", frequency: "Mensual" },
        { name: "Flujo de efectivo", content: "Entradas, salidas, disponibilidad y proyección de tesorería", frequency: "Semanal o mensual" },
        { name: "Presupuesto vs. resultados", content: "Comparación entre cifras presupuestadas y reales, con análisis de desviaciones", frequency: "Mensual" },
        { name: "Análisis de cuentas por cobrar", content: "Antigüedad de saldos, cartera vencida, rotación y días de cobranza", frequency: "Mensual" },
        { name: "Análisis de cuentas por pagar", content: "Obligaciones, vencimientos y prioridades de pago", frequency: "Mensual" },
        { name: "Análisis de rentabilidad", content: "Márgenes por producto, cliente, unidad de negocio o proyecto, según información disponible", frequency: "Mensual o trimestral" },
        { name: "Indicadores financieros (KPIs)", content: "Seguimiento de metas financieras y alertas", frequency: "Mensual" },
        { name: "Informe ejecutivo del CFO", content: "Diagnóstico, riesgos, recomendaciones y acciones prioritarias", frequency: "Mensual" }
      ],
      scopePolicy: "La estructura de paquetes confirmada define el alcance base. La tabla general de entregables sirve de referencia; no implica que todos estén incluidos en cada nivel ni añade entregables ausentes del paquete. Conservar las periodicidades alternativas y las condiciones de información disponible. Los alcances específicos y adicionales se confirman en la propuesta comercial; los servicios excluidos se cotizan por separado."
    },
    taxAdvisory: {
      name: "Asesoría fiscal",
      includes: ["Declaraciones mensuales y anuales", "Regularización SAT", "Facturación electrónica", "Cambios de régimen", "Asesoría fiscal personalizada"],
      pricingPolicy: "Solicitudes puntuales, como una declaración anual, sujetas a cotización del contador; no asignarles automáticamente un paquete mensual."
    },
    businessConsulting: {
      name: "Consultoría empresarial",
      description: "Orientación empresarial en control financiero y estrategia de crecimiento según las necesidades del negocio.",
      pricingPolicy: "Alcance y honorarios sujetos a cotización del equipo."
    }
  },
  complementaryServices: ["Arrendamiento Puro", "PPR", "Seguro de Gastos Médicos Mayores", "Seguro de Hombre Clave", "Seguro de Auto", "Vale de Gasolina Empresarial"],
  complementaryServicesPolicy: "Estrategia fiscal y protección financiera; confirmar alcance y cotización con el equipo, sin asumir su inclusión en un paquete o CFO Externo."
} as const;

const recommendationNames = [
  ...Object.values(contaMagnoCommercialCatalog.services).map((service) => service.name),
  ...contaMagnoCommercialCatalog.services.accounting.individualPackages.map((plan) => plan.name),
  ...contaMagnoCommercialCatalog.complementaryServices
];

// Canonicalize only explicit names, never infer a recommendation from lead data.
export function normalizeRecommendation(value: string): string {
  const key = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[_\s]+/g, " ").trim().toLowerCase();
  return recommendationNames.find((name) => key(name) === key(value)) ?? value.trim();
}

export const qualificationClosingMessage = "Gracias por compartir tus datos. El equipo de Conta Magno se pondrá en contacto contigo por este mismo chat para revisar tus necesidades y continuar la atención.";

export const cfoQualificationClosingMessage = "Gracias por compartir tus datos. El equipo de Conta Magno se pondrá en contacto contigo por este mismo chat para coordinar una llamada de diagnóstico inicial con el responsable de Conta Magno, evaluar tus necesidades y preparar una propuesta personalizada.";
