
import { Lead, QualityIndicator, CrmStatus } from '../types';

// Helper to get past date ISO string
const getPastDate = (minsAgo: number = 0, hoursAgo: number = 0, daysAgo: number = 0) => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - minsAgo);
    d.setHours(d.getHours() - hoursAgo);
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString();
};

export const MOCK_LEADS: Lead[] = [
  {
    id: "1",
    nombre: "Julio",
    apellido: "Cesar",
    correo: "julio.c@example.com",
    whatsapp: "+57 300 123 4567",
    aeronave: "Piper Seneca",
    origen: "Bogotá",
    destino: "Cartagena",
    valor: "4500 USD",
    indicadorCalidad: QualityIndicator.SQL,
    vendido: "",
    fecha: "2023-10-25",
    fechaRegreso: "2023-10-28",
    source: "GOOGLE",
    campana: "Q4_Luxury",
    createdAt: getPastDate(45), // 45 mins ago
    crmStatus: CrmStatus.NUEVO,
    isFavorite: false
  },
  {
    id: "2",
    nombre: "Andrés",
    apellido: "Nuñez",
    correo: "andres.n@corporate.com",
    whatsapp: "310 987 6543",
    aeronave: "King Air 350",
    origen: "Medellín",
    destino: "Miami",
    valor: "18000 USD",
    indicadorCalidad: QualityIndicator.SQL,
    vendido: "",
    fecha: "2023-10-24",
    fechaRegreso: "2023-11-01",
    source: "LINKEDIN",
    campana: "Corporate_Travel",
    createdAt: getPastDate(0, 5), // 5 hours ago
    crmStatus: CrmStatus.SEGUIMIENTO,
    isFavorite: true
  },
  {
    id: "3",
    nombre: "Maria",
    apellido: "Rodriguez",
    correo: "mrodriguez@gmail.com",
    whatsapp: "+52 55 1234 5678",
    aeronave: "Cessna Citation",
    origen: "Cancún",
    destino: "Toluca",
    valor: "12000 USD",
    indicadorCalidad: QualityIndicator.MQL,
    vendido: "",
    fecha: "2023-10-26",
    fechaRegreso: "",
    source: "INSTAGRAM",
    campana: "Lifestyle",
    createdAt: getPastDate(0, 0, 2), // 2 days ago
    crmStatus: "", // Empty to test auto-categorization logic
    isFavorite: false
  },
  {
    id: "4",
    nombre: "Carlos",
    apellido: "Sarmiento",
    correo: "csarmiento@investments.co",
    whatsapp: "315-555-0100",
    aeronave: "Gulfstream G650",
    origen: "Bogotá",
    destino: "Madrid",
    valor: "110000 USD",
    indicadorCalidad: QualityIndicator.SQL,
    vendido: "X",
    fecha: "2023-10-20",
    fechaRegreso: "2023-10-30",
    source: "REFERRAL",
    campana: "VIP",
    createdAt: getPastDate(0, 0, 15), // 15 days ago
    crmStatus: "", // Should go to Ganados due to 'X'
    isFavorite: false
  },
  {
    id: "5",
    nombre: "Elena",
    apellido: "Vargas",
    correo: "elena.v@example.com",
    whatsapp: "320 111 2233",
    aeronave: "Piper Seneca",
    origen: "Barranquilla",
    destino: "Santa Marta",
    valor: "2500 USD",
    indicadorCalidad: QualityIndicator.MQL,
    vendido: "",
    fecha: "2023-10-27",
    fechaRegreso: "2023-10-27",
    source: "FACEBOOK",
    campana: "Short_Haul",
    createdAt: getPastDate(0, 0, 45), // 45 days ago
    crmStatus: CrmStatus.COTIZADO,
    isFavorite: true
  }
];
