// ============================================================
// ImmoGame — Constants & Default Values
// ============================================================

export const BUNDESLAENDER = {
  'Baden-Württemberg':        { grunderwerbsteuer: 5.0 },
  'Bayern':                   { grunderwerbsteuer: 3.5 },
  'Berlin':                   { grunderwerbsteuer: 6.0 },
  'Brandenburg':              { grunderwerbsteuer: 6.5 },
  'Bremen':                   { grunderwerbsteuer: 5.0 },
  'Hamburg':                  { grunderwerbsteuer: 5.5 },
  'Hessen':                   { grunderwerbsteuer: 6.0 },
  'Mecklenburg-Vorpommern':   { grunderwerbsteuer: 6.0 },
  'Niedersachsen':            { grunderwerbsteuer: 5.0 },
  'Nordrhein-Westfalen':      { grunderwerbsteuer: 6.5 },
  'Rheinland-Pfalz':          { grunderwerbsteuer: 5.0 },
  'Saarland':                 { grunderwerbsteuer: 6.5 },
  'Sachsen':                  { grunderwerbsteuer: 5.5 },
  'Sachsen-Anhalt':           { grunderwerbsteuer: 5.0 },
  'Schleswig-Holstein':       { grunderwerbsteuer: 6.5 },
  'Thüringen':                { grunderwerbsteuer: 5.0 },
};

// AfA-Sätze basierend auf Baujahr
export const AFA_RATES = {
  altbau:    { rate: 2.5, years: 40, label: 'Altbau (vor 1925) — 2,5 % auf 40 Jahre' },
  bestand:   { rate: 2.0, years: 50, label: 'Bestandsbau (1925–2023) — 2,0 % auf 50 Jahre' },
  neubau_linear:    { rate: 3.0, years: 33, label: 'Neubau linear (ab 2024) — 3,0 % auf 33 Jahre' },
  neubau_degressiv: { rate: 5.0, years: 20, label: 'Neubau degressiv (ab 2024) — 5,0 % degressiv' },
};

// Standardwerte für den Quick-Check
export const DEFAULTS = {
  // Finanzierung
  eigenkapitalProzent: 20,     // % vom Kaufpreis
  zinssatz: 3.5,               // % p.a.
  tilgungssatz: 2.0,           // % p.a.
  zinsbindung: 10,             // Jahre
  sondertilgung: 0,            // € p.a.

  // Nebenkosten
  notarkosten: 1.5,            // %
  grundbuchkosten: 0.5,        // %
  maklerkosten: 3.57,          // % (inkl. MwSt)

  // Miet-Parameter
  nichtUmlagefaehigProzent: 35, // % des Hausgeldes
  verwaltungskostenMonat: 25,   // € / Monat
  leerstandswagnis: 3,          // % der Jahresmiete
  mietsteigerungPa: 1.5,        // % p.a.

  // Objekt
  gebaeudeantelil: 75,          // % des Kaufpreises
  wertsteigerungPa: 1.5,        // % p.a.

  // Steuer
  grenzsteuersatz: 42,          // %
  grundsteuerJahr: 400,         // € / Jahr

  // Modernisierung
  modernisierungskosten: 0,     // €

  // Baujahr → AfA
  baujahr: 1990,
};

// Ampel-Schwellenwerte
export const AMPEL = {
  gruen: {
    minCashflow: 0,          // positiver monatlicher Cashflow
    minBruttoRendite: 5.0,   // %
  },
  gelb: {
    minCashflow: -100,       // leicht negativ
    minBruttoRendite: 4.0,   // %
  },
  // alles darunter → rot
};

// Sensitivitätsanalyse Bereiche
export const SENSITIVITY = {
  zinsRange:  { min: 1.5, max: 6.0, step: 0.5 },
  mieteRange: { min: -20, max: 20, step: 5 },  // % Änderung
};

/**
 * Bestimmt den AfA-Typ basierend auf dem Baujahr
 */
export function getAfaType(baujahr) {
  if (baujahr < 1925) return 'altbau';
  if (baujahr <= 2023) return 'bestand';
  return 'neubau_degressiv'; // Default für Neubau
}
