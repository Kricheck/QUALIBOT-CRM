import { GoogleGenAI } from "@google/genai";
import { Lead } from "../types";

export const generateQuoteMessage = async (lead: Lead): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    const price = (lead.valor && lead.valor.trim() !== "" && lead.valor !== "0") 
      ? lead.valor 
      : "$ [Por definir]";

    // Contexto de Amaderarte
    const product = lead.aeronave || "[Producto de Interés]";
    const city = lead.origen || "[Ciudad]";
    const details = lead.destino || "[Detalle Proyecto]";
    const name = lead.nombre || "Cliente";

    const prompt = `
      Actúa como Asesor Comercial de Amaderarte (Expertos en madera y diseño).
      Tu tarea es redactar un mensaje de cotización o propuesta inicial para WhatsApp.
      
      OBJETIVO:
      Redactar un mensaje profesional, cálido y enfocado en diseño/calidad, invitando a cerrar el negocio o agendar visita.
      
      --- MARCO DE REFERENCIA ---
      Hola *${name}* 👋

      Te saluda el equipo de *Amaderarte*. Gracias por confiar en nosotros para tu proyecto.

      Hemos analizado tu solicitud para *${product}* en *${city}* (${details}) y esta es nuestra propuesta preliminar:

      🔹 *Proyecto:* ${product} (Acabados Premium)
      🔹 *Presupuesto Estimado:* ${price}
      🔹 *Tiempo Entrega:* A convenir según diseño.

      *Incluye:* Diseño 3D preliminar, materiales de alta calidad y garantía por 1 año.

      ¿Te gustaría que agendemos una visita técnica para tomar medidas exactas y ajustar el diseño a tu espacio? 📐

      Quedo atento.
      
      *Amaderarte - Diseño y Madera*
      -----------------------------------------------

      DATOS DEL CLIENTE:
      - Nombre: ${name}
      - Producto: ${product}
      - Ubicación: ${city}
      - Detalle: ${details}
      - Valor: ${price}

      INSTRUCCIONES:
      1. Usa un solo asterisco (*) para negritas.
      2. Tono: Artesanal, profesional, confiable.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { temperature: 0.5 }
    });

    let text = response.text || "";
    text = text.replace(/\*\*/g, '*'); // Safety fix
    return text.trim();

  } catch (error) {
    console.error("Error generating AI message:", error);
    return `Hola *${lead.nombre}* 👋\n\nGracias por contactar a *Amaderarte*.\n\nRespecto a tu interés en *${lead.aeronave || 'nuestros productos'}*, tenemos una propuesta estimada de *${lead.valor || 'valor a confirmar'}*.\n\n¿Podemos agendar una llamada para revisar los detalles de materiales y medidas?\n\nAtentamente,\n*Equipo Amaderarte*`;
  }
};