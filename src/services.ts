export const SERVICES = ["SPSA HD", "Transferencia", "Refrigerado", "MASS", "Paquetería", "Giddings", "TPSA"] as const;
export type AttendanceService = typeof SERVICES[number];
export const validService = (value: string): value is AttendanceService => SERVICES.some(service => service === value);

// Normalize labels at read time; original attendance documents remain immutable.
export const canonicalService = (value?: string): string => {
  const service = value?.trim() ?? "";
  const key = service.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return ({"sps home delivery":"SPSA HD", "sps home delivey":"SPSA HD", "spsa hd":"SPSA HD", "mass":"MASS", "refrigereado":"Refrigerado", "refrigerado":"Refrigerado", "paqueteria":"Paquetería", "transferencia":"Transferencia", "giddings":"Giddings", "tpsa":"TPSA"} as Record<string,string>)[key] ?? service;
};

export const ALL_SERVICES = "all";
export const NO_SERVICE = "none";
export const serviceMatches = (service: string | undefined, filter: string) => filter === ALL_SERVICES || (filter === NO_SERVICE ? !canonicalService(service) : canonicalService(service) === canonicalService(filter));
export const summaryServiceMatches = (services: string, filter: string) => filter === ALL_SERVICES || (filter === NO_SERVICE ? !services : services.split(" / ").some(service=>canonicalService(service)===canonicalService(filter)));
export const serviceFilterLabel = (filter: string) => filter === ALL_SERVICES ? "Todos los servicios" : filter === NO_SERVICE ? "Sin servicio" : filter;
