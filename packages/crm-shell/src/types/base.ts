/**
 * BaseLead — Interface base compartida entre todos los CRMs del monorepo Qualibot.
 *
 * Contiene los campos que existen en TODAS las apps. Cada app extiende esta
 * interface con sus campos específicos de negocio.
 *
 * Regla: si un campo solo existe en una app, va en la interface derivada,
 * NO aquí.
 */
export interface BaseLead {
  id: string;
  nombre: string;
  apellido: string;
  correo: string;
  whatsapp: string;
  /** Campo de contexto derecho — semántica varía por app (aeronave, producto, fachada) */
  aeronave: string;
  /** Campo de contexto izquierdo — semántica varía por app (origen, ubicación, ciudad) */
  origen: string;
  /** Campo de detalle — semántica varía por app (destino, dirección) */
  destino: string;
  /** Valor monetario como string para admitir símbolos de moneda o rangos */
  valor: string;
  /** String base para acomodar distintos enums QualityIndicator por app */
  indicadorCalidad: string;
  /** "X" o vacío */
  vendido: string;
  /** Fecha principal del lead (fecha de vuelo, fecha de creación, etc.) */
  fecha: string;
  /** Fecha de regreso — disponible en ambas apps aunque no siempre usada */
  fechaRegreso?: string;
  source: string;
  campana: string;
  createdAt?: string;
  /** String base para acomodar distintos enums CrmStatus por app */
  crmStatus: string;
  isFavorite?: boolean;
}
