
import { GoogleGenAI } from "@google/genai";
import { Lead } from "../types";

// Initialize AI client
// SECURITY: VITE_GEMINI_API_KEY must be set in .env (never hardcode here).
// If missing, AI features degrade gracefully to static templates.
const _geminiApiKey: string = import.meta.env.VITE_GEMINI_API_KEY ?? "";
if (!_geminiApiKey) {
  console.warn("[aiService] VITE_GEMINI_API_KEY no configurada. Las funciones de IA usarán plantillas estáticas.");
}
const ai = _geminiApiKey ? new GoogleGenAI({ apiKey: _geminiApiKey }) : null;

// Single source of truth for the model used across all AI calls
const GEMINI_MODEL = 'gemini-2.5-flash';

/**
 * Lists all Gemini models available for the configured API key.
 * Useful for diagnostics when a model returns a 404 NOT_FOUND error.
 * Call this to verify which model IDs are valid before using them.
 */
export const listAvailableModels = async (): Promise<{ name: string; displayName: string }[]> => {
  if (!ai) return [];
  const result: { name: string; displayName: string }[] = [];
  // ai.models.list() returns Promise<Pager<Model>> — must await before iterating
  for await (const model of await ai.models.list()) {
    result.push({
      name: model.name?.replace('models/', '') ?? '',
      displayName: model.displayName ?? model.name ?? '',
    });
  }
  return result;
};

export const generateQuoteMessage = async (lead: Lead): Promise<string> => {
  try {
    // 1. Logic for Data Pre-processing
    const price = (lead.valor && lead.valor.trim() !== "" && lead.valor !== "0")
      ? lead.valor
      : "$X.XXX.XXX";

    const isRoundTrip = !!lead.fechaRegreso;

    const dateText = isRoundTrip
      ? `del ${lead.fecha || "[Fecha Ida]"} al ${lead.fechaRegreso}`
      : `el ${lead.fecha || "[Fecha Ida]"}`;

    const aircraft = lead.aeronave || "[Aeronave]";
    const origin = lead.origen || "[Origen]";
    const destination = lead.destino || "[Destino]";
    const name = lead.nombre || "Cliente";

    // 2. Construct Prompt using the new Framework Approach
    const prompt = `
      Actúa como Mateo Cruz, Asesor Concierge de Flapz.
      Tu tarea es redactar un mensaje de cotización de vuelo privado para WhatsApp.
      
      OBJETIVO:
      Utiliza el siguiente texto como MARCO DE REFERENCIA. Tu meta es adaptar este estilo para crear un mensaje profesional y persuasivo que invite a la conversación.
      
      --- MARCO DE REFERENCIA (ESTRUCTURA BASE) ---
      Hola *Andres Guillermo* 👋

      Soy Mateo Cruz, tu contacto personal en *Flapz*. Gracias por considerarnos para tu próximo vuelo.

      He buscado las mejores alternativas para tu itinerario *Bogotá - Medellín* y quiero presentarte nuestra recomendación principal:

      🔹 *Aeronave:* King Air C90 (Eficiencia y confort garantizados)
      🔹 *Tarifa:* $30.400.000 COP
      🔹 *Fechas:* 07 al 10 de Ene, 2026

      *Tu tarifa incluye:* Vuelo privado, tripulación calificada y tasas.

      ¿Te gustaría revisar otras opciones o prefieres agendar una breve llamada para explicarte los detalles técnicos? 📲

      Quedo a tu disposición.

      Mateo Cruz
      *Concierge Flapz*
      -----------------------------------------------

      DATOS DEL CLIENTE ACTUAL:
      - Nombre: ${name}
      - Ruta: ${origin} - ${destination}
      - Fechas: ${dateText}
      - Aeronave Sugerida: ${aircraft}
      - Valor Cotizado: ${price}

      INSTRUCCIONES DE FORMATO CRÍTICAS:
      1. FORMATO DE NEGRITA: WhatsApp usa un solo asterisco (*texto*). NUNCA uses doble asterisco (**texto**). Esto es un error grave.
         CORRECTO: *Aeronave:*
         INCORRECTO: **Aeronave:**
      2. Usa el marco de referencia como base, optimizando la redacción para sonar natural y persuasivo.
      3. Mantén los emojis de lista (🔹).
    `;

    // 3. Call Gemini
    if (!ai) throw new Error("API key no configurada");
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        temperature: 0.5,
      }
    });

    // 4. Clean up response 
    let text = response.text || "";

    // SAFETY FIX: Replace double asterisks with single asterisks just in case the AI ignored the instruction.
    // Also ensures no triple asterisks appear.
    text = text.replace(/\*\*/g, '*');

    return text.trim();

  } catch (error) {
    console.error("Error generating AI message:", error);
    // Fallback message matching the new Reference Framework
    const isRoundTrip = !!lead.fechaRegreso;
    const dateText = isRoundTrip
      ? `del ${lead.fecha} al ${lead.fechaRegreso}`
      : `el ${lead.fecha}`;

    return `Hola *${lead.nombre}* 👋\n\nSoy Mateo Cruz, tu contacto personal en *Flapz*. Gracias por considerarnos para tu próximo vuelo.\n\nHe buscado las mejores alternativas para tu itinerario *${lead.origen} - ${lead.destino}* y quiero presentarte nuestra recomendación principal:\n\n🔹 *Aeronave:* ${lead.aeronave || 'Aeronave'} (Eficiencia y confort garantizados)\n🔹 *Tarifa:* ${lead.valor || 'Por confirmar'}\n🔹 *Fechas:* ${dateText}\n\n*Tu tarifa incluye:* Vuelo privado, tripulación calificada y tasas.\n\n¿Te gustaría revisar otras opciones o prefieres agendar una breve llamada para explicarte los detalles técnicos? 📲\n\nQuedo a tu disposición.\n\nMateo Cruz\n*Concierge Flapz*`;
  }
};

/**
 * Generates a personalized outbound email for Apollo leads in "Nuevo" status.
 * Uses Google Search Grounding so Gemini researches the company before writing,
 * ensuring each email reflects real knowledge of the business rather than generic copy.
 */
export const generateOutboundEmail = async (lead: Lead): Promise<{ text: string, prompt: string }> => {
  const rawCargo = lead.cargo || "Directivo";
  const rawEmpresa = lead.compania || "su organización";
  const firstName = lead.nombre ? lead.nombre.split(' ')[0] : 'Estimado(a)';

  const prompt = `
CONTEXTO: Eres Mateo Cruz, Concierge Senior en Flapz. Flapz es una empresa colombiana que ayuda a directivos y empresas a encontrar las mejores opciones de vuelos chárter en Colombia. El destinatario quizás no nos conoce, así que debes presentar Flapz de forma natural y concreta en la primera línea — sin taglines de marketing.

OBJETIVO DEL CORREO: Primer contacto frío. Romper el hielo. Despertar curiosidad. Abrir una conversación. NO es para cerrar una venta.

═══════════════════════════════════════
PASO 1 — INVESTIGACIÓN (interna, no aparece en el correo)
═══════════════════════════════════════
Usa la herramienta de búsqueda para entender a ${rawEmpresa}. Concéntrate en Colombia primero. Necesitas identificar:

a) ¿Cuál es el negocio principal y qué operaciones físicas tiene en Colombia? (ciudades, sedes, plantas, proyectos activos)
b) ¿Qué tipo de desplazamiento ejecutivo es más frecuente para alguien con el cargo "${rawCargo}"? (supervisión de campo, reuniones con clientes B2B, visitas a sedes regionales, etc.)
c) ¿Hay algo concreto del negocio de ${rawEmpresa} que haga obvia la necesidad de moverse rápido entre ciudades colombianas?

REGLA CRÍTICA DE INVESTIGACIÓN: Los datos que encuentres son para ENTENDER el negocio y hacer el correo relevante. NO los cites en el correo. No menciones cifras, porcentajes, inversiones ni noticias de prensa. Usa ese conocimiento para hablar como alguien que conoce la industria, no como un analista.

═══════════════════════════════════════
PASO 2 — REDACCIÓN
═══════════════════════════════════════
Destinatario: ${firstName}, ${rawCargo} de ${rawEmpresa}.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EJEMPLO DE REFERENCIA — Tono y longitud que debes lograr
(No es una plantilla. Es el estándar de calidad.)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Asunto: Menos escalas, más Claro en toda Colombia

  Hola Julian,

  Soy Mateo de Flapz — nos dedicamos a ayudar a directivos y empresas a
  encontrar las mejores opciones de vuelos chárter en Colombia. Con la red de
  Claro operando en Bogotá, Medellín, Cali, Barranquilla y decenas de municipios
  simultáneamente, su agenda de supervisión probablemente exige estar en dos
  lugares a la vez con una frecuencia que Avianca no resuelve.

  En Flapz adaptamos el vuelo a usted: sale cuando lo necesita, aterriza
  directamente donde su equipo lo espera, sin escalas ni filas que le roben
  horas de operación. Hay directivos de telecomunicaciones que hoy coordinan
  visitas a múltiples ciudades en el mismo día gracias a vuelos a la carta.

  Aquí puede ver la flota que pondríamos a su disposición:

  [[ BOTÓN: CONOCER FLOTA ]]

  O si prefiere, responda este correo y le cotizamos su próxima ruta sin
  ningún compromiso.

  Saludos,
  Mateo Cruz
  Concierge Flapz
  www.flapz.app | @flapzapp

¿POR QUÉ ESE CORREO FUNCIONA?
✓ Dos párrafos con sustancia: el primero engancha, el segundo convence — sin volverse pesado
✓ Primera línea: presenta Flapz + hook específico de Claro en una sola oración
✓ El segundo párrafo usa un caso de uso del sector (telecomunicaciones) para hacer tangible el beneficio
✓ El hook usa conocimiento real del negocio sin citar datos de prensa
✓ El CTA primario es el setup natural del botón → ese clic es la conversión medible
✓ El CTA secundario baja la barrera: "responda este correo" es menos compromiso que agendar una reunión
✓ Tono humano: "Soy Mateo de Flapz", no "Me dirijo a usted en nombre de..."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGLAS ABSOLUTAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. EXTENSIÓN: El cuerpo del correo (excluyendo asunto, saludo y firma) debe tener entre 90 y 120 palabras. Suficiente para enganchar y convencer, sin volverse un bloque de texto imposible de leer. Dos párrafos de 2 oraciones cada uno es la estructura ideal.

2. PRESENTACIÓN DE FLAPZ: La primera oración del cuerpo debe presentar Flapz de forma concreta y directa — sin taglines de marketing ni frases grandilocuentes. Usa el estilo: "Soy Mateo de Flapz — nos dedicamos a ayudar a directivos y empresas a encontrar las mejores opciones de vuelos chárter en Colombia." Luego, en la misma oración o en la siguiente, conecta con la realidad específica de ${rawEmpresa}.

3. PROHIBIDO citar cifras, inversiones, porcentajes o noticias de prensa aunque las hayas encontrado en la investigación.

4. PROHIBIDO frases genéricas:
   ✗ "empresas del calibre de la suya" / "su envergadura"
   ✗ "el dinamismo de [empresa]" / "sector tan competitivo"
   ✗ "sé que su tiempo es valioso" / "en el mundo actual"
   ✗ cualquier frase que funcione igual para una empresa de otro sector

5. El hook del primer párrafo debe ser tan específico que si cambias "${rawEmpresa}" por otra empresa, la oración dejaría de tener sentido.

6. CTA: Una línea que funcione como setup directo del botón "Conocer Flota". El objetivo es que el lector haga clic en el botón — ese clic es la conversión que mide la fuerza comercial. Ejemplos válidos: "Aquí puede ver la flota que pondríamos a su disposición:" / "Lo invito a conocer la flota disponible para sus próximos viajes:" / "Puede explorar la flota directamente aquí:". PROHIBIDO preguntas que no lleven al botón ni CTAs que compitan con él.

7. Incluir [[ BOTÓN: CONOCER FLOTA ]] después del CTA primario.

8. CTA SECUNDARIO (después del botón, antes de la firma): Una línea breve que baje la barrera de entrada. Invita a responder el correo directamente o a tener una conversación sin compromiso para cotizar su próxima ruta. Ejemplos: "O si prefiere, responda este correo y le cotizamos su próxima ruta sin ningún compromiso." / "Si prefiere hablarlo, con una breve llamada le contamos todo lo que Flapz puede hacer por usted."

═══════════════════════════════════════
FORMATO DE SALIDA
═══════════════════════════════════════
Asunto: [Corto, específico, menciona ${rawEmpresa} o su realidad operativa]

Hola ${firstName},

[Párrafo 1 — 2 oraciones:
  Oración 1: "Soy Mateo de Flapz — [descripción concreta de lo que hacemos, no un tagline]." + hook específico que muestra que conoces a ${rawEmpresa}. Ejemplo de descripción válida: "nos dedicamos a ayudar a directivos y empresas a encontrar las mejores opciones de vuelos chárter en Colombia."
  Oración 2: amplía el contexto del problema — por qué para alguien en el cargo ${rawCargo} de ${rawEmpresa} los vuelos comerciales son un obstáculo real]

[Párrafo 2 — 2 oraciones:
  Oración 1: el beneficio concreto de Flapz, traducido al sector y al cargo ${rawCargo}
  Oración 2: un caso de uso específico o prueba social del sector que haga tangible el valor]

[Setup del botón — 1 línea que haga que hacer clic sea el paso obvio]

[[ BOTÓN: CONOCER FLOTA ]]

[CTA secundario — 1 línea que baje la barrera: invitar a responder el correo o a una breve conversación para cotizar sin compromiso]

Saludos,
Mateo Cruz
Concierge Flapz
www.flapz.app | @flapzapp
  `;

  try {
    if (!ai) throw new Error("VITE_GEMINI_API_KEY no configurada");
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        temperature: 0.9,
        tools: [{ googleSearch: {} }],
      }
    });

    const text = response.text || "";
    return { text, prompt };
  } catch (error: any) {
    console.error("AI Error:", error);
    throw new Error(`Gemini Error: ${error.message || "Failed to generate content"}`);
  }
};
