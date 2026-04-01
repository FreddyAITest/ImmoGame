// ============================================================
// ImmoGame — Core Calculation Engine
// ============================================================

import { BUNDESLAENDER, AFA_RATES, DEFAULTS, AMPEL, getAfaType } from './constants.js';

/**
 * Main calculation function — takes all inputs and returns a comprehensive result object.
 * @param {Object} params — All deal parameters
 * @returns {Object} — Complete calculation results
 */
export function calculateDeal(params) {
  const p = { ...DEFAULTS, ...params };

  // ── 1. Kaufnebenkosten ──────────────────────────
  const land = BUNDESLAENDER[p.bundesland] || { grunderwerbsteuer: 5.0 };
  const grunderwerbsteuer = p.kaufpreis * (land.grunderwerbsteuer / 100);
  const notarkosten = p.kaufpreis * (p.notarkosten / 100);
  const grundbuchkosten = p.kaufpreis * (p.grundbuchkosten / 100);
  const maklerkosten = p.kaufpreis * (p.maklerkosten / 100);
  const kaufnebenkosten = grunderwerbsteuer + notarkosten + grundbuchkosten + maklerkosten;
  const kaufnebenkostenProzent = (kaufnebenkosten / p.kaufpreis) * 100;

  // ── 2. Gesamtkosten & Finanzierung ──────────────
  const gesamtkosten = p.kaufpreis + kaufnebenkosten + p.modernisierungskosten;
  const eigenkapital = p.eigenkapitalProzent !== undefined
    ? p.kaufpreis * (p.eigenkapitalProzent / 100)
    : (p.eigenkapitalAbsolut || 0);
  const darlehenssumme = Math.max(0, gesamtkosten - eigenkapital);

  // Annuitätenberechnung
  const monatszins = p.zinssatz / 100 / 12;
  const annuitaet = darlehenssumme > 0
    ? darlehenssumme * (p.zinssatz + p.tilgungssatz) / 100 / 12
    : 0;

  // ── 3. Mieteinnahmen ────────────────────────────
  const jahresmiete = p.kaltmiete * 12;
  const nichtUmlagefaehig = p.hausgeld * (p.nichtUmlagefaehigProzent / 100);
  const leerstandswagnis = jahresmiete * (p.leerstandswagnis / 100) / 12;
  const nettoMieteinnahmenMonat = p.kaltmiete - nichtUmlagefaehig - p.verwaltungskostenMonat - leerstandswagnis;

  // ── 4. Cashflow vor Steuern ─────────────────────
  const grundsteuerMonat = p.grundsteuerJahr / 12;
  const cashflowVorSteuernMonat = nettoMieteinnahmenMonat - annuitaet - grundsteuerMonat;
  const cashflowVorSteuernJahr = cashflowVorSteuernMonat * 12;

  // ── 5. Steuerberechnung (AfA) ───────────────────
  const afaType = p.afaType || getAfaType(p.baujahr);
  const afaInfo = AFA_RATES[afaType];
  const gebaeudewert = p.kaufpreis * (p.gebaeudeantelil / 100);
  const afaJahr = gebaeudewert * (afaInfo.rate / 100);

  // Werbungskosten (Jahr 1) — Zinsen + AfA + NK
  const zinsenJahr1 = darlehenssumme * (p.zinssatz / 100);
  const werbungskostenJahr = zinsenJahr1 + afaJahr + nichtUmlagefaehig * 12
    + p.verwaltungskostenMonat * 12 + (jahresmiete * p.leerstandswagnis / 100)
    + p.grundsteuerJahr;

  // Zu versteuerndes Einkommen aus Vermietung
  const zuVersteuerndesEinkommen = jahresmiete - werbungskostenJahr;
  const steuerEffektJahr = zuVersteuerndesEinkommen * (p.grenzsteuersatz / 100);
  const steuerEffektMonat = steuerEffektJahr / 12;

  // Cashflow nach Steuern
  const cashflowNachSteuernMonat = cashflowVorSteuernMonat - steuerEffektMonat;
  const cashflowNachSteuernJahr = cashflowNachSteuernMonat * 12;

  // ── 6. Rendite-Kennzahlen ───────────────────────
  const bruttoMietrendite = (jahresmiete / p.kaufpreis) * 100;
  const nettoMietrendite = ((nettoMieteinnahmenMonat * 12) / gesamtkosten) * 100;
  const kaufpreisfaktor = p.kaufpreis / jahresmiete;
  const eigenkapitalRendite = eigenkapital > 0
    ? (cashflowNachSteuernJahr / eigenkapital) * 100
    : 0;

  // ── 7. Ampel-Bewertung ─────────────────────────
  let ampel = 'rot';
  if (cashflowVorSteuernMonat >= AMPEL.gruen.minCashflow && bruttoMietrendite >= AMPEL.gruen.minBruttoRendite) {
    ampel = 'gruen';
  } else if (cashflowVorSteuernMonat >= AMPEL.gelb.minCashflow && bruttoMietrendite >= AMPEL.gelb.minBruttoRendite) {
    ampel = 'gelb';
  }

  // ── 8. 10-Jahres-Simulation ─────────────────────
  const simulation = simulate10Years(p, darlehenssumme, eigenkapital, annuitaet, afaInfo, gebaeudewert);

  return {
    // Eingaben Echo
    kaufpreis: p.kaufpreis,
    bundesland: p.bundesland,
    kaltmiete: p.kaltmiete,
    hausgeld: p.hausgeld,

    // Nebenkosten
    grunderwerbsteuer,
    notarkosten,
    grundbuchkosten,
    maklerkosten,
    kaufnebenkosten,
    kaufnebenkostenProzent,

    // Finanzierung
    gesamtkosten,
    eigenkapital,
    darlehenssumme,
    annuitaet,
    monatszins,

    // Mieteinnahmen
    jahresmiete,
    nichtUmlagefaehig,
    leerstandswagnis,
    nettoMieteinnahmenMonat,
    verwaltungskostenMonat: p.verwaltungskostenMonat,

    // Cashflow
    grundsteuerMonat,
    cashflowVorSteuernMonat,
    cashflowVorSteuernJahr,

    // Steuern
    afaType,
    afaInfo,
    afaJahr,
    zinsenJahr1,
    werbungskostenJahr,
    zuVersteuerndesEinkommen,
    steuerEffektJahr,
    steuerEffektMonat,
    cashflowNachSteuernMonat,
    cashflowNachSteuernJahr,

    // Rendite
    bruttoMietrendite,
    nettoMietrendite,
    kaufpreisfaktor,
    eigenkapitalRendite,

    // Ampel
    ampel,

    // Simulation
    simulation,
  };
}

/**
 * Simulate 10 years of ownership including tilgung, appreciation, cashflows
 */
function simulate10Years(p, darlehenssumme, eigenkapital, annuitaet, afaInfo, gebaeudewert) {
  const years = [];
  let restschuld = darlehenssumme;
  let kaltmiete = p.kaltmiete;
  let immobilienWert = p.kaufpreis;
  let kumulierterCashflow = 0;

  // IRR cashflows: first is negative (equity investment)
  const irrCashflows = [-(eigenkapital)];

  for (let jahr = 1; jahr <= 10; jahr++) {
    // Mietsteigerung ab Jahr 2
    if (jahr > 1) {
      kaltmiete *= (1 + p.mietsteigerungPa / 100);
    }
    const jahresmiete = kaltmiete * 12;

    // Wertsteigerung
    if (jahr > 1) {
      immobilienWert *= (1 + p.wertsteigerungPa / 100);
    }

    // Tilgungsverlauf
    let zinsenJahr = restschuld * (p.zinssatz / 100);
    let tilgungJahr = (annuitaet * 12) - zinsenJahr + (p.sondertilgung || 0);
    tilgungJahr = Math.min(tilgungJahr, restschuld); // can't pay more than owed
    restschuld = Math.max(0, restschuld - tilgungJahr);

    // Miet-Netto
    const nichtUmlagefaehig = p.hausgeld * (p.nichtUmlagefaehigProzent / 100);
    const leerstandswagnis = jahresmiete * (p.leerstandswagnis / 100) / 12;
    const nettoMietMonat = kaltmiete - nichtUmlagefaehig - p.verwaltungskostenMonat - leerstandswagnis;
    const nettoMietJahr = nettoMietMonat * 12;

    // Cashflow vor Steuern
    const cashflowVorSteuern = nettoMietJahr - (annuitaet * 12) - p.grundsteuerJahr;

    // AfA + Steuereffekt
    const afaJahr = gebaeudewert * (afaInfo.rate / 100);
    const werbungskosten = zinsenJahr + afaJahr + (nichtUmlagefaehig * 12)
      + (p.verwaltungskostenMonat * 12) + (jahresmiete * p.leerstandswagnis / 100)
      + p.grundsteuerJahr;
    const zuVersteuern = jahresmiete - werbungskosten;
    const steuerEffekt = zuVersteuern * (p.grenzsteuersatz / 100);

    const cashflowNachSteuern = cashflowVorSteuern - steuerEffekt;
    kumulierterCashflow += cashflowNachSteuern;

    // Eigenkapital durch Tilgung
    const eigenkapitalDurchTilgung = darlehenssumme - restschuld;

    years.push({
      jahr,
      kaltmiete: Math.round(kaltmiete),
      jahresmiete: Math.round(jahresmiete),
      immobilienWert: Math.round(immobilienWert),
      restschuld: Math.round(restschuld),
      zinsenJahr: Math.round(zinsenJahr),
      tilgungJahr: Math.round(tilgungJahr),
      cashflowVorSteuern: Math.round(cashflowVorSteuern),
      cashflowNachSteuern: Math.round(cashflowNachSteuern),
      kumulierterCashflow: Math.round(kumulierterCashflow),
      eigenkapitalDurchTilgung: Math.round(eigenkapitalDurchTilgung),
      afaJahr: Math.round(afaJahr),
      steuerEffekt: Math.round(steuerEffekt),
    });

    // IRR: annual cashflow (except year 10 which includes sale)
    if (jahr < 10) {
      irrCashflows.push(cashflowNachSteuern);
    } else {
      // Year 10: cashflow + sale proceeds - restschuld already included
      const verkaufserloes = immobilienWert - restschuld; // no tax after 10 years
      irrCashflows.push(cashflowNachSteuern + verkaufserloes);
    }
  }

  // Exit-Szenario
  const lastYear = years[years.length - 1];
  const verkaufspreis = lastYear.immobilienWert;
  const verkaufsNebenkosten = verkaufspreis * 0.02; // ~2% for selling
  const nettoVerkaufserloes = verkaufspreis - lastYear.restschuld - verkaufsNebenkosten;
  const gesamtgewinn = nettoVerkaufserloes + kumulierterCashflow - eigenkapital;
  const eigenkapitalMultiple = eigenkapital > 0 ? ((eigenkapital + gesamtgewinn) / eigenkapital) : 0;

  // IRR berechnen
  const irr = calculateIRR(irrCashflows) * 100;

  // EK-Rendite nach Verkauf (annualisiert)
  const ekRenditeNachVerkauf = eigenkapital > 0
    ? (Math.pow((eigenkapital + gesamtgewinn) / eigenkapital, 1 / 10) - 1) * 100
    : 0;

  return {
    years,
    exit: {
      verkaufspreis,
      verkaufsNebenkosten: Math.round(verkaufsNebenkosten),
      nettoVerkaufserloes: Math.round(nettoVerkaufserloes),
      restschuld: lastYear.restschuld,
      kumulierterCashflow: Math.round(kumulierterCashflow),
      eigenkapitalEingesetzt: Math.round(eigenkapital),
      gesamtgewinn: Math.round(gesamtgewinn),
      eigenkapitalMultiple: Math.round(eigenkapitalMultiple * 100) / 100,
      irr: Math.round(irr * 100) / 100,
      ekRenditeNachVerkauf: Math.round(ekRenditeNachVerkauf * 100) / 100,
    },
    irrCashflows,
  };
}

/**
 * Newton-Raphson IRR calculation
 */
function calculateIRR(cashflows, guess = 0.1, maxIterations = 100, tolerance = 0.00001) {
  let rate = guess;

  for (let i = 0; i < maxIterations; i++) {
    let npv = 0;
    let dnpv = 0;

    for (let t = 0; t < cashflows.length; t++) {
      const factor = Math.pow(1 + rate, t);
      npv += cashflows[t] / factor;
      dnpv -= t * cashflows[t] / (factor * (1 + rate));
    }

    const newRate = rate - npv / dnpv;

    if (Math.abs(newRate - rate) < tolerance) {
      return newRate;
    }

    rate = newRate;

    // Guard against divergence
    if (isNaN(rate) || !isFinite(rate)) {
      return 0;
    }
  }

  return rate;
}

/**
 * Sensitivitätsanalyse: Berechne Cashflow für verschiedene Zins-/Miete-Kombinationen
 */
export function calculateSensitivity(baseParams, zinsRange, mieteRange) {
  const matrix = [];

  for (const zins of zinsRange) {
    const row = [];
    for (const mieteAenderung of mieteRange) {
      const adjustedParams = {
        ...baseParams,
        zinssatz: zins,
        kaltmiete: baseParams.kaltmiete * (1 + mieteAenderung / 100),
      };
      const result = calculateDeal(adjustedParams);
      row.push({
        zins,
        mieteAenderung,
        cashflowMonat: Math.round(result.cashflowVorSteuernMonat),
        bruttoRendite: Math.round(result.bruttoMietrendite * 100) / 100,
        ampel: result.ampel,
      });
    }
    matrix.push(row);
  }

  return matrix;
}

/**
 * Generate range array for sensitivity
 */
export function generateRange(min, max, step) {
  const range = [];
  for (let v = min; v <= max + 0.0001; v += step) {
    range.push(Math.round(v * 100) / 100);
  }
  return range;
}
