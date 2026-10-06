// Acceso por sección según nivel jerárquico
export const SECTIONS = {
  inicio: "Inicio", pipeline: "Embudo", direccion: "Dirección", catalogo: "Catálogo",
  cotizaciones: "Cotizaciones", demo: "Centro de demo", integraciones: "Integraciones",
};

export const ACCESS = {
  director: ["inicio", "pipeline", "direccion", "catalogo", "cotizaciones", "demo", "integraciones"],
  gerente: ["inicio", "pipeline", "catalogo", "cotizaciones", "demo"],
  vendedor: ["inicio", "pipeline", "catalogo", "cotizaciones", "demo"],
};

// Qué datos ve cada rol dentro de las secciones
export const SCOPE = {
  director: "Todo el grupo · todas las marcas y salas",
  gerente: "Su marca (Jetour) · todas las salas y asesores",
  vendedor: "Solo sus leads, cotizaciones y agenda",
};

export const can = (role, section) => (ACCESS[role] || []).includes(section);
