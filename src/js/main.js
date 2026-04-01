// ============================================================
// ImmoGame — Main Application Entry Point
// ============================================================

import { calculateDeal, calculateSensitivity, generateRange } from './core/calculator.js';
import { BUNDESLAENDER, DEFAULTS, SENSITIVITY } from './core/constants.js';
import { saveDeal as storageSaveDeal, getAllDeals, deleteDeal, loadDeal, exportDeals, importDeals, getConnectionStatus } from './api/storage.js';
import { signIn, signOut, onAuthStateChange } from './api/auth.js';

// ── State ─────────────────────────────────────────────────
let currentResults = null;
let currentParams = null;
let cashflowChart = null;
let wealthChart = null;
let activeTab = 'dealchecker';
let saveSource = 'qc'; // which tab initiated save

// ── Formatting Helpers ────────────────────────────────────
const fmt = {
  eur: (v) => {
    if (v == null || isNaN(v)) return '—';
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
  },
  eurFull: (v) => {
    if (v == null || isNaN(v)) return '—';
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(v);
  },
  pct: (v, decimals = 1) => {
    if (v == null || isNaN(v)) return '—';
    return v.toFixed(decimals).replace('.', ',') + ' %';
  },
  num: (v, decimals = 1) => {
    if (v == null || isNaN(v)) return '—';
    return v.toFixed(decimals).replace('.', ',');
  },
};

// ── DOM Helpers ───────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

// ── Initialize ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initQuickCheck();
  initDeepDive();
  initCollapsibles();
  initSaveModal();
  initDealsTab();
  initAuth();
  
  // Initial state
  activateTab('dealchecker');
  runQuickCheck();
  runDeepDive();
  updateConnectionBadge();
});

// ── Authentication UI ───────────────────────────────────────
function initAuth() {
  const btnGoogle = $('btn-login-google');
  const btnGithub = $('btn-login-github');
  const btnLogout = $('btn-logout');

  if (btnGoogle) {
    btnGoogle.addEventListener('click', () => signIn('google'));
  }
  if (btnGithub) {
    btnGithub.addEventListener('click', () => signIn('github'));
  }
  if (btnLogout) {
    btnLogout.addEventListener('click', () => signOut());
  }

  onAuthStateChange((event, session) => {
    const loggedOutDiv = $('auth-logged-out');
    const loggedInDiv = $('auth-logged-in');
    const userNameSpan = $('auth-user-name');

    if (session && session.user) {
      // User is logged in
      loggedOutDiv.classList.add('hidden');
      loggedInDiv.classList.remove('hidden');
      loggedInDiv.classList.add('flex');
      
      const email = session.user.email;
      const metadataName = session.user.user_metadata?.full_name || session.user.user_metadata?.name;
      userNameSpan.textContent = metadataName || email;
      userNameSpan.title = email;
      
      // Refresh the deals list when auth state changes to load user's deals
      if (activeTab === 'deals') renderDealList();
    } else {
      // User is logged out
      loggedOutDiv.classList.remove('hidden');
      loggedInDiv.classList.add('hidden');
      loggedInDiv.classList.remove('flex');
      
      if (activeTab === 'deals') renderDealList();
    }
  });
}

// ── Tab Navigation ───────────────────────────────────────
function initTabs() {
  $$('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      activateTab(tab);
    });
  });
}

function activateTab(tab) {
  activeTab = tab;

  // Tab buttons
  $$('.tab-btn').forEach(b => {
    const isActive = b.dataset.tab === tab;
    if (isActive) {
      b.classList.add('bg-gradient-to-br', 'from-gold-light', 'to-gold', 'text-dark-900', 'shadow-lg', 'shadow-gold/20');
      b.classList.remove('text-slate-400', 'bg-transparent', 'hover:text-slate-100', 'hover:bg-white/[0.04]');
    } else {
      b.classList.remove('bg-gradient-to-br', 'from-gold-light', 'to-gold', 'text-dark-900', 'shadow-lg', 'shadow-gold/20');
      b.classList.add('text-slate-400', 'bg-transparent', 'hover:text-slate-100', 'hover:bg-white/[0.04]');
    }
  });

  // Tab content
  $$('.tab-content').forEach(c => {
    if (c.id === `content-${tab}`) {
      c.classList.remove('hidden');
    } else {
      c.classList.add('hidden');
    }
  });

  if (tab === 'stresstest') runStressTest();
  if (tab === 'deals') renderDealList();
}

// ══════════════════════════════════════════════════════════
// TAB 1: DEAL CHECKER
// ══════════════════════════════════════════════════════════
function initQuickCheck() {
  // Input listeners for live calculation
  const inputs = ['qc-kaufpreis', 'qc-kaltmiete', 'qc-hausgeld', 'qc-bundesland',
                   'qc-ek-slider', 'qc-zins-slider', 'qc-tilgung-slider'];
  
  inputs.forEach(id => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('input', () => {
      updateSliderDisplays();
      runQuickCheck();
    });
  });

  // Save button
  $('qc-save-btn').addEventListener('click', () => {
    saveSource = 'qc';
    openSaveModal();
  });
}

function updateSliderDisplays() {
  const ekVal = parseFloat($('qc-ek-slider').value);
  $('qc-ek-display').textContent = `${ekVal} %`;

  const zinsVal = parseFloat($('qc-zins-slider').value);
  $('qc-zins-display').textContent = zinsVal.toFixed(1).replace('.', ',') + ' %';

  const tilgVal = parseFloat($('qc-tilgung-slider').value);
  $('qc-tilgung-display').textContent = tilgVal.toFixed(1).replace('.', ',') + ' %';
}

function getQuickCheckParams() {
  return {
    kaufpreis: parseFloat($('qc-kaufpreis').value) || 0,
    kaltmiete: parseFloat($('qc-kaltmiete').value) || 0,
    hausgeld: parseFloat($('qc-hausgeld').value) || 0,
    bundesland: $('qc-bundesland').value,
    eigenkapitalProzent: parseFloat($('qc-ek-slider').value),
    zinssatz: parseFloat($('qc-zins-slider').value),
    tilgungssatz: parseFloat($('qc-tilgung-slider').value),
  };
}

function runQuickCheck() {
  const params = getQuickCheckParams();
  if (!params.kaufpreis || !params.kaltmiete) return;

  const result = calculateDeal(params);
  currentResults = result;
  currentParams = params;
  renderQuickCheckResults(result);
}

function renderQuickCheckResults(r) {
  // Ampel
  const ampelEl = $('qc-ampel');
  const ampelLabel = $('qc-ampel-label');

  const ampelStyles = {
    gruen: { border: 'border-green-500', bg: 'bg-green-500/10', anim: 'ampel-gruen', color: 'text-green-500', icon: '✓', label: 'Guter Deal' },
    gelb:  { border: 'border-yellow-500', bg: 'bg-yellow-500/10', anim: 'ampel-gelb', color: 'text-yellow-500', icon: '~', label: 'Prüfen' },
    rot:   { border: 'border-red-500', bg: 'bg-red-500/10', anim: 'ampel-rot', color: 'text-red-500', icon: '✗', label: 'Vorsicht' },
  };
  const a = ampelStyles[r.ampel];
  ampelEl.className = `w-[100px] h-[100px] rounded-full flex items-center justify-center text-[2.5rem] transition-all duration-500 border-2 ${a.border} ${a.bg} ${a.anim}`;
  ampelEl.textContent = a.icon;
  ampelLabel.className = `text-lg font-bold uppercase tracking-[2px] ${a.color}`;
  ampelLabel.textContent = a.label;

  // Metrics
  $('qc-bruttorendite').textContent = fmt.pct(r.bruttoMietrendite);
  $('qc-kaufpreisfaktor').textContent = fmt.num(r.kaufpreisfaktor, 1) + 'x';

  const cfEl = $('qc-cashflow');
  cfEl.textContent = fmt.eur(r.cashflowVorSteuernMonat);
  cfEl.className = `font-mono text-2xl font-bold ${r.cashflowVorSteuernMonat >= 0 ? 'text-green-500' : 'text-red-500'}`;
  $('qc-cashflow-sub').textContent = `nach Steuern: ${fmt.eur(r.cashflowNachSteuernMonat)}`;

  $('qc-nettorendite').textContent = fmt.pct(r.nettoMietrendite);
  $('qc-kreditrate').textContent = fmt.eur(r.annuitaet);
  $('qc-darlehen').textContent = fmt.eur(r.darlehenssumme);

  // Nebenkosten breakdown
  const nkHtml = `
    <div class="flex justify-between items-center py-2 border-b border-white/[0.04]">
      <span class="text-sm text-slate-400">Grunderwerbsteuer (${BUNDESLAENDER[r.bundesland]?.grunderwerbsteuer || '?'} %)</span>
      <span class="font-mono font-semibold text-sm">${fmt.eur(r.grunderwerbsteuer)}</span>
    </div>
    <div class="flex justify-between items-center py-2 border-b border-white/[0.04]">
      <span class="text-sm text-slate-400">Notar (~${DEFAULTS.notarkosten} %)</span>
      <span class="font-mono font-semibold text-sm">${fmt.eur(r.notarkosten)}</span>
    </div>
    <div class="flex justify-between items-center py-2 border-b border-white/[0.04]">
      <span class="text-sm text-slate-400">Grundbuch (~${DEFAULTS.grundbuchkosten} %)</span>
      <span class="font-mono font-semibold text-sm">${fmt.eur(r.grundbuchkosten)}</span>
    </div>
    <div class="flex justify-between items-center py-2 border-b border-white/[0.04]">
      <span class="text-sm text-slate-400">Makler (${DEFAULTS.maklerkosten} %)</span>
      <span class="font-mono font-semibold text-sm">${fmt.eur(r.maklerkosten)}</span>
    </div>
    <div class="section-sep my-2"></div>
    <div class="flex justify-between items-center py-2">
      <span class="text-sm font-semibold text-slate-100">Kaufnebenkosten gesamt (${fmt.pct(r.kaufnebenkostenProzent)})</span>
      <span class="font-mono font-semibold text-lg text-green-500">${fmt.eur(r.kaufnebenkosten)}</span>
    </div>
  `;
  $('qc-nk-breakdown').innerHTML = nkHtml;
}

// ══════════════════════════════════════════════════════════
// TAB 2: DEEP DIVE
// ══════════════════════════════════════════════════════════
function initDeepDive() {
  const inputs = [
    'dd-kaufpreis', 'dd-wohnflaeche', 'dd-baujahr', 'dd-bundesland',
    'dd-gebaeudeanteil', 'dd-eigenkapital', 'dd-zinssatz', 'dd-tilgung',
    'dd-zinsbindung', 'dd-sondertilgung', 'dd-modernisierung', 'dd-makler',
    'dd-notar', 'dd-kaltmiete', 'dd-hausgeld', 'dd-nichtumlagefaehig',
    'dd-verwaltung', 'dd-leerstand', 'dd-mietsteigerung', 'dd-steuersatz',
    'dd-grundsteuer', 'dd-wertsteigerung', 'dd-afa-typ'
  ];

  inputs.forEach(id => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('input', runDeepDive);
    el.addEventListener('change', runDeepDive);
  });

  $('dd-save-btn').addEventListener('click', () => {
    saveSource = 'dd';
    openSaveModal();
  });

  $('dd-export-pdf-btn').addEventListener('click', exportToPDF);
}

function getDeepDiveParams() {
  const afaTyp = $('dd-afa-typ').value;
  const notarTotal = parseFloat($('dd-notar').value) || 2.0;
  return {
    kaufpreis: parseFloat($('dd-kaufpreis').value) || 0,
    kaltmiete: parseFloat($('dd-kaltmiete').value) || 0,
    hausgeld: parseFloat($('dd-hausgeld').value) || 0,
    bundesland: $('dd-bundesland').value,
    baujahr: parseInt($('dd-baujahr').value) || 1990,
    gebaeudeantelil: parseFloat($('dd-gebaeudeanteil').value) || 75,
    eigenkapitalProzent: parseFloat($('dd-eigenkapital').value) || 0,
    zinssatz: parseFloat($('dd-zinssatz').value) || 3.5,
    tilgungssatz: parseFloat($('dd-tilgung').value) || 2,
    zinsbindung: parseInt($('dd-zinsbindung').value) || 10,
    sondertilgung: parseFloat($('dd-sondertilgung').value) || 0,
    modernisierungskosten: parseFloat($('dd-modernisierung').value) || 0,
    maklerkosten: parseFloat($('dd-makler').value) || 0,
    notarkosten: notarTotal * 0.75, // rough split
    grundbuchkosten: notarTotal * 0.25,
    nichtUmlagefaehigProzent: parseFloat($('dd-nichtumlagefaehig').value) || 35,
    verwaltungskostenMonat: parseFloat($('dd-verwaltung').value) || 25,
    leerstandswagnis: parseFloat($('dd-leerstand').value) || 3,
    mietsteigerungPa: parseFloat($('dd-mietsteigerung').value) || 1.5,
    grenzsteuersatz: parseFloat($('dd-steuersatz').value) || 42,
    grundsteuerJahr: parseFloat($('dd-grundsteuer').value) || 400,
    wertsteigerungPa: parseFloat($('dd-wertsteigerung').value) || 1.5,
    afaType: afaTyp === 'auto' ? undefined : afaTyp,
  };
}

function runDeepDive() {
  const params = getDeepDiveParams();
  if (!params.kaufpreis || !params.kaltmiete) return;

  const result = calculateDeal(params);
  currentResults = result;
  currentParams = params;
  renderDeepDiveResults(result);
}

function renderDeepDiveResults(r) {
  // Key metrics
  $('dd-bruttorendite').textContent = fmt.pct(r.bruttoMietrendite);

  const cfEl = $('dd-cashflow-monat');
  cfEl.textContent = fmt.eur(r.cashflowVorSteuernMonat);
  cfEl.className = `font-mono text-2xl font-bold ${r.cashflowVorSteuernMonat >= 0 ? 'text-green-500' : 'text-red-500'}`;

  const irrEl = $('dd-irr');
  irrEl.textContent = fmt.pct(r.simulation.exit.irr);
  irrEl.className = `font-mono text-2xl font-bold ${r.simulation.exit.irr >= 5 ? 'text-green-500' : 'text-gold'}`;

  const ekMultiEl = $('dd-ek-multi');
  ekMultiEl.textContent = fmt.num(r.simulation.exit.eigenkapitalMultiple, 2) + 'x';
  ekMultiEl.className = `font-mono text-2xl font-bold ${r.simulation.exit.eigenkapitalMultiple >= 2 ? 'text-green-500' : ''}`;

  $('dd-kaufpreisfaktor').textContent = fmt.num(r.kaufpreisfaktor, 1) + 'x';
  $('dd-nettorendite').textContent = fmt.pct(r.nettoMietrendite);

  const ekRendEl = $('dd-ek-rendite');
  ekRendEl.textContent = fmt.pct(r.simulation.exit.ekRenditeNachVerkauf);
  ekRendEl.className = `font-mono text-2xl font-bold ${r.simulation.exit.ekRenditeNachVerkauf >= 5 ? 'text-green-500' : ''}`;

  $('dd-afa-jahr').textContent = fmt.eur(r.afaJahr);

  // Cashflow chart
  renderCashflowChart(r.simulation.years);

  // Wealth chart
  renderWealthChart(r.simulation.years, r.kaufpreis);

  // Exit panel
  renderExitPanel(r.simulation.exit);

  // Annuitätenplan table
  renderAnnuitaetenTable(r.simulation.years);
}

function renderCashflowChart(years) {
  const ctx = $('dd-cashflow-chart').getContext('2d');

  const labels = years.map(y => `Jahr ${y.jahr}`);
  const dataVorSteuern = years.map(y => y.cashflowVorSteuern);
  const dataNachSteuern = years.map(y => y.cashflowNachSteuern);

  if (cashflowChart) cashflowChart.destroy();

  cashflowChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Cashflow vor Steuern',
          data: dataVorSteuern,
          backgroundColor: dataVorSteuern.map(v => v >= 0 ? 'rgba(34, 197, 94, 0.6)' : 'rgba(239, 68, 68, 0.6)'),
          borderColor: dataVorSteuern.map(v => v >= 0 ? '#22C55E' : '#EF4444'),
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: 'Cashflow nach Steuern',
          data: dataNachSteuern,
          backgroundColor: dataNachSteuern.map(v => v >= 0 ? 'rgba(59, 130, 246, 0.5)' : 'rgba(239, 68, 68, 0.3)'),
          borderColor: dataNachSteuern.map(v => v >= 0 ? '#3B82F6' : '#EF4444'),
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#94A3B8', font: { family: 'Inter', size: 11 } },
        },
        tooltip: {
          backgroundColor: '#1E293B',
          titleColor: '#F1F5F9',
          bodyColor: '#94A3B8',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${fmt.eur(ctx.raw)}`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: '#64748B', font: { family: 'Inter', size: 11 } },
          grid: { color: 'rgba(255,255,255,0.03)' },
        },
        y: {
          ticks: {
            color: '#64748B',
            font: { family: 'JetBrains Mono', size: 11 },
            callback: (v) => fmt.eur(v),
          },
          grid: { color: 'rgba(255,255,255,0.03)' },
        },
      },
    },
  });
}

function renderWealthChart(years, kaufpreis) {
  const ctx = $('dd-wealth-chart').getContext('2d');

  const labels = years.map(y => `Jahr ${y.jahr}`);
  const tilgung = years.map(y => y.eigenkapitalDurchTilgung);
  const wertsteigerung = years.map(y => y.immobilienWert - kaufpreis);
  const kumuliertCF = years.map(y => y.kumulierterCashflow);

  if (wealthChart) wealthChart.destroy();

  wealthChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'EK durch Tilgung',
          data: tilgung,
          borderColor: '#22C55E',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointBackgroundColor: '#22C55E',
        },
        {
          label: 'Wertsteigerung',
          data: wertsteigerung,
          borderColor: '#3B82F6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointBackgroundColor: '#3B82F6',
        },
        {
          label: 'Kumulierter Cashflow',
          data: kumuliertCF,
          borderColor: '#F5A623',
          backgroundColor: 'rgba(245, 166, 35, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointBackgroundColor: '#F5A623',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#94A3B8', font: { family: 'Inter', size: 11 } },
        },
        tooltip: {
          backgroundColor: '#1E293B',
          titleColor: '#F1F5F9',
          bodyColor: '#94A3B8',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${fmt.eur(ctx.raw)}`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: '#64748B', font: { family: 'Inter', size: 11 } },
          grid: { color: 'rgba(255,255,255,0.03)' },
        },
        y: {
          ticks: {
            color: '#64748B',
            font: { family: 'JetBrains Mono', size: 11 },
            callback: (v) => fmt.eur(v),
          },
          grid: { color: 'rgba(255,255,255,0.03)' },
        },
      },
    },
  });
}

function renderExitPanel(exit) {
  const rows = [
    { label: 'Geschätzter Verkaufspreis', value: fmt.eur(exit.verkaufspreis) },
    { label: 'Restschuld nach 10 Jahren', value: '−' + fmt.eur(exit.restschuld) },
    { label: 'Verkaufsnebenkosten (~2%)', value: '−' + fmt.eur(exit.verkaufsNebenkosten) },
    { label: 'Netto-Verkaufserlös', value: fmt.eur(exit.nettoVerkaufserloes) },
    { label: 'Kumulierter Cashflow', value: fmt.eur(exit.kumulierterCashflow) },
    { label: 'Eigenkapital eingesetzt', value: '−' + fmt.eur(exit.eigenkapitalEingesetzt) },
    { label: 'Gesamtgewinn', value: fmt.eur(exit.gesamtgewinn), highlight: true },
    { label: 'EK-Rendite p.a. (nach Verkauf)', value: fmt.pct(exit.ekRenditeNachVerkauf), highlight: true },
    { label: 'IRR (Interner Zinsfuß)', value: fmt.pct(exit.irr), highlight: true },
    { label: 'Eigenkapital-Multiple', value: exit.eigenkapitalMultiple + 'x', highlight: true },
  ];

  $('dd-exit-rows').innerHTML = rows.map(r =>
    `<div class="flex justify-between items-center py-2 ${r.highlight ? 'pt-3' : 'border-b border-white/[0.04]'}">
      <span class="text-sm ${r.highlight ? 'font-semibold text-slate-100' : 'text-slate-400'}">${r.label}</span>
      <span class="font-mono font-semibold ${r.highlight ? 'text-lg text-green-500' : 'text-sm text-slate-100'}">${r.value}</span>
    </div>`
  ).join('');
}

function renderAnnuitaetenTable(years) {
  $('dd-annuitaeten-body').innerHTML = years.map(y =>
    `<tr class="hover:bg-white/[0.02]">
      <td class="py-2 px-3 text-left text-slate-100 font-semibold border-b border-white/[0.03] whitespace-nowrap">Jahr ${y.jahr}</td>
      <td class="py-2 px-3 text-right text-slate-400 border-b border-white/[0.03] whitespace-nowrap">${fmt.eur(y.jahresmiete)}</td>
      <td class="py-2 px-3 text-right text-slate-400 border-b border-white/[0.03] whitespace-nowrap">${fmt.eur(y.zinsenJahr)}</td>
      <td class="py-2 px-3 text-right text-slate-400 border-b border-white/[0.03] whitespace-nowrap">${fmt.eur(y.tilgungJahr)}</td>
      <td class="py-2 px-3 text-right text-slate-400 border-b border-white/[0.03] whitespace-nowrap">${fmt.eur(y.restschuld)}</td>
      <td class="py-2 px-3 text-right border-b border-white/[0.03] whitespace-nowrap ${y.cashflowVorSteuern >= 0 ? 'text-green-500' : 'text-red-500'}">${fmt.eur(y.cashflowVorSteuern)}</td>
      <td class="py-2 px-3 text-right border-b border-white/[0.03] whitespace-nowrap ${y.cashflowNachSteuern >= 0 ? 'text-green-500' : 'text-red-500'}">${fmt.eur(y.cashflowNachSteuern)}</td>
      <td class="py-2 px-3 text-right border-b border-white/[0.03] whitespace-nowrap ${y.kumulierterCashflow >= 0 ? 'text-green-500' : 'text-red-500'}">${fmt.eur(y.kumulierterCashflow)}</td>
    </tr>`
  ).join('');
}

// ══════════════════════════════════════════════════════════
// TAB 3: STRESS TEST
// ══════════════════════════════════════════════════════════
function runStressTest() {
  const params = currentParams || getDeepDiveParams();
  if (!params.kaufpreis || !params.kaltmiete) return;

  const zinsRange = generateRange(SENSITIVITY.zinsRange.min, SENSITIVITY.zinsRange.max, SENSITIVITY.zinsRange.step);
  const mieteRange = generateRange(SENSITIVITY.mieteRange.min, SENSITIVITY.mieteRange.max, SENSITIVITY.mieteRange.step);

  const matrix = calculateSensitivity(params, zinsRange, mieteRange);
  renderHeatmap(matrix, zinsRange, mieteRange, params.zinssatz);
  renderScenarios(params);
}

function renderHeatmap(matrix, zinsRange, mieteRange, currentZins) {
  let html = '<table class="w-full font-mono text-xs" style="border-collapse: separate; border-spacing: 3px;">';

  // Header row
  html += '<tr><th class="py-2.5 px-3 text-center text-gold text-[0.7rem] font-semibold uppercase tracking-[0.5px]">Zins ↓ / Miete →</th>';
  mieteRange.forEach(m => {
    html += `<th class="py-2.5 px-3 text-center text-slate-400 text-[0.7rem] font-semibold uppercase tracking-[0.5px]">${m > 0 ? '+' : ''}${m} %</th>`;
  });
  html += '</tr>';

  // Data rows
  matrix.forEach((row, ri) => {
    const zins = zinsRange[ri];
    html += `<tr><th class="py-2.5 px-4 text-right text-slate-500 text-xs font-semibold">${fmt.pct(zins)}</th>`;
    row.forEach((cell, ci) => {
      const miete = mieteRange[ci];
      const isCurrentZins = Math.abs(zins - currentZins) < 0.01;
      const isCurrentMiete = Math.abs(miete) < 0.01;
      const isCurrent = isCurrentZins && isCurrentMiete;

      let colorCls = 'bg-red-500/10 text-red-500 border border-red-500/20';
      if (cell.cashflowMonat >= 0) colorCls = 'bg-green-500/10 text-green-500 border border-green-500/20';
      else if (cell.cashflowMonat >= -100) colorCls = 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20';

      html += `<td class="p-0 relative text-center align-middle"><div class="heatmap-cell inline-flex items-center justify-center w-full h-full min-h-[40px] px-2 py-2.5 rounded-lg font-semibold transition-all duration-150 cursor-default ${colorCls} ${isCurrent ? 'heatmap-current' : ''}">${fmt.eur(cell.cashflowMonat)}</div></td>`;
    });
    html += '</tr>';
  });

  html += '</table>';
  $('st-heatmap').innerHTML = html;
}

function renderScenarios(params) {
  // Best: low Zins + higher Miete
  const best = calculateDeal({ ...params, zinssatz: 2.0, kaltmiete: params.kaltmiete * 1.1 });
  // Base: current
  const base = calculateDeal(params);
  // Worst: high Zins + lower Miete
  const worst = calculateDeal({ ...params, zinssatz: 5.5, kaltmiete: params.kaltmiete * 0.9 });

  const setCF = (id, val) => {
    const el = $(id);
    el.textContent = fmt.eur(val);
  };

  setCF('st-best-cf', best.cashflowVorSteuernMonat);
  $('st-best-rendite').textContent = fmt.pct(best.bruttoMietrendite);

  setCF('st-base-cf', base.cashflowVorSteuernMonat);
  $('st-base-rendite').textContent = fmt.pct(base.bruttoMietrendite);

  setCF('st-worst-cf', worst.cashflowVorSteuernMonat);
  $('st-worst-rendite').textContent = fmt.pct(worst.bruttoMietrendite);
}

// ══════════════════════════════════════════════════════════
// COLLAPSIBLES
// ══════════════════════════════════════════════════════════
function initCollapsibles() {
  const pairs = [
    ['qc-nk-toggle', 'qc-nk-content'],
    ['dd-annuitaeten-toggle', 'dd-annuitaeten-content'],
  ];

  pairs.forEach(([toggleId, contentId]) => {
    const toggle = $(toggleId);
    const content = $(contentId);
    if (!toggle || !content) return;

    toggle.addEventListener('click', () => {
      toggle.classList.toggle('open');
      content.classList.toggle('open');
    });
  });
}

// ══════════════════════════════════════════════════════════
// SAVE MODAL
// ══════════════════════════════════════════════════════════
function initSaveModal() {
  $('save-modal-cancel').addEventListener('click', closeSaveModal);
  $('save-modal-confirm').addEventListener('click', confirmSave);
  $('save-modal').addEventListener('click', (e) => {
    if (e.target === $('save-modal')) closeSaveModal();
  });
}

function openSaveModal() {
  $('save-deal-name').value = '';
  const modal = $('save-modal');
  modal.classList.remove('opacity-0', 'pointer-events-none');
  modal.classList.add('opacity-100', 'pointer-events-auto');
  modal.querySelector('.bg-dark-800').classList.remove('translate-y-5');
  modal.querySelector('.bg-dark-800').classList.add('translate-y-0');
  setTimeout(() => $('save-deal-name').focus(), 300);
}

function closeSaveModal() {
  const modal = $('save-modal');
  modal.classList.add('opacity-0', 'pointer-events-none');
  modal.classList.remove('opacity-100', 'pointer-events-auto');
  modal.querySelector('.bg-dark-800').classList.add('translate-y-5');
  modal.querySelector('.bg-dark-800').classList.remove('translate-y-0');
}

async function confirmSave() {
  const name = $('save-deal-name').value.trim();
  if (!name) {
    $('save-deal-name').style.borderColor = '#EF4444';
    return;
  }

  const params = saveSource === 'dd' ? getDeepDiveParams() : getQuickCheckParams();
  const result = calculateDeal(params);

  await storageSaveDeal(name, params, result);
  closeSaveModal();
  showToast(`"${name}" gespeichert ✓`);
}

// ══════════════════════════════════════════════════════════
// DEALS TAB
// ══════════════════════════════════════════════════════════
function initDealsTab() {
  $('deals-export-btn').addEventListener('click', () => {
    const json = exportDeals();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `immogame_deals_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Deals exportiert ✓');
  });

  $('deals-import-btn').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const count = await importDeals(ev.target.result);
          showToast(`${count} Deals importiert ✓`);
          renderDealList();
        } catch (err) {
          showToast(`Fehler: ${err.message}`);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  });
}

async function renderDealList() {
  const deals = await getAllDeals();
  const container = $('deals-list');

  if (!deals.length) {
    container.innerHTML = '<p class="text-slate-500 text-center py-8">Noch keine Deals gespeichert. Berechne einen Deal und klicke auf "Deal speichern".</p>';
    return;
  }

  container.innerHTML = deals.map(deal => {
    const ampelColors = { gruen: 'bg-green-500', gelb: 'bg-yellow-500', rot: 'bg-red-500' };
    const ampelBg = ampelColors[deal.results?.ampel] || 'bg-slate-500';
    const date = new Date(deal.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const cfColor = (deal.results?.cashflowVorSteuernMonat || 0) >= 0 ? 'text-green-500' : 'text-red-500';

    return `
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4 px-4 py-3 bg-slate-900/80 border border-glass-border rounded-lg transition-all duration-150 hover:border-glass-border-hover hover:bg-dark-600/40" data-id="${deal.id}">
        <div class="flex items-center gap-3">
          <div class="w-2.5 h-2.5 rounded-full ${ampelBg}"></div>
          <div class="flex flex-col gap-0.5">
            <span class="font-semibold text-sm text-slate-100">${deal.name}</span>
            <span class="text-[0.7rem] text-slate-500">${date}</span>
          </div>
        </div>
        <div class="flex gap-4 font-mono text-xs">
          <span class="text-slate-400">CF: <span class="${cfColor}">${fmt.eur(deal.results?.cashflowVorSteuernMonat)}</span></span>
          <span class="text-slate-400">Rendite: <span class="text-gold">${fmt.pct(deal.results?.bruttoMietrendite)}</span></span>
        </div>
        <div class="flex gap-1.5">
          <button class="deal-load-btn px-3 py-1.5 text-xs font-semibold bg-white/5 text-slate-400 border border-glass-border rounded-lg transition-all duration-150 hover:bg-white/[0.08] hover:text-slate-100 cursor-pointer" data-id="${deal.id}">Laden</button>
          <button class="deal-delete-btn px-3 py-1.5 text-xs font-semibold bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg transition-all duration-150 hover:bg-red-500/20 cursor-pointer" data-id="${deal.id}">✕</button>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.deal-load-btn').forEach(btn => {
    btn.addEventListener('click', () => loadDealIntoForm(btn.dataset.id));
  });
  container.querySelectorAll('.deal-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      await deleteDeal(btn.dataset.id);
      await renderDealList();
      showToast('Deal gelöscht');
    });
  });
}

async function loadDealIntoForm(id) {
  const deal = await loadDeal(id);
  if (!deal) return;

  const p = deal.params;

  // Load into Deal-Checker
  if (p.kaufpreis) $('qc-kaufpreis').value = p.kaufpreis;
  if (p.kaltmiete) $('qc-kaltmiete').value = p.kaltmiete;
  if (p.hausgeld) $('qc-hausgeld').value = p.hausgeld;
  if (p.bundesland) $('qc-bundesland').value = p.bundesland;
  if (p.eigenkapitalProzent != null) $('qc-ek-slider').value = p.eigenkapitalProzent;
  if (p.zinssatz) $('qc-zins-slider').value = p.zinssatz;
  if (p.tilgungssatz) $('qc-tilgung-slider').value = p.tilgungssatz;

  // Load into Deep-Dive
  if (p.kaufpreis) $('dd-kaufpreis').value = p.kaufpreis;
  if (p.kaltmiete) $('dd-kaltmiete').value = p.kaltmiete;
  if (p.hausgeld) $('dd-hausgeld').value = p.hausgeld;
  if (p.bundesland) $('dd-bundesland').value = p.bundesland;
  if (p.baujahr) $('dd-baujahr').value = p.baujahr;
  if (p.gebaeudeantelil) $('dd-gebaeudeanteil').value = p.gebaeudeantelil;
  if (p.eigenkapitalProzent != null) $('dd-eigenkapital').value = p.eigenkapitalProzent;
  if (p.zinssatz) $('dd-zinssatz').value = p.zinssatz;
  if (p.tilgungssatz) $('dd-tilgung').value = p.tilgungssatz;
  if (p.modernisierungskosten != null) $('dd-modernisierung').value = p.modernisierungskosten;

  updateSliderDisplays();
  runQuickCheck();
  runDeepDive();
  activateTab('dealchecker');
  showToast(`"${deal.name}" geladen`);
}

// ══════════════════════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════════════════════
function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('toast-show');
  toast.classList.add('border-green-500/30');
  setTimeout(() => {
    toast.classList.remove('toast-show');
    toast.classList.remove('border-green-500/30');
  }, 2500);
}

// ══════════════════════════════════════════════════════════
// CONNECTION STATUS
// ══════════════════════════════════════════════════════════
async function updateConnectionBadge() {
  const dot = $('connection-dot');
  const label = $('connection-label');
  const status = await getConnectionStatus();

  if (status === 'supabase') {
    dot.className = 'w-1.5 h-1.5 rounded-full bg-green-500';
    label.textContent = 'Supabase verbunden';
  } else {
    dot.className = 'w-1.5 h-1.5 rounded-full bg-yellow-500';
    label.textContent = 'Lokaler Speicher';
  }
}

// ══════════════════════════════════════════════════════════
// PDF EXPORT
// ══════════════════════════════════════════════════════════
async function exportToPDF() {
  const btn = $('dd-export-pdf-btn');
  const originalText = btn.innerHTML;

  btn.innerHTML = '<span class="animate-spin inline-block w-4 h-4 border-2 border-slate-300 border-t-transparent flex-shrink-0 rounded-full mr-2 align-middle"></span> Generiere PDF...';
  btn.disabled = true;

  try {
    const params = currentParams || getDeepDiveParams();
    const result = currentResults;
    if (!params.kaufpreis || !result) {
      showToast('Bitte zuerst Werte eingeben');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const W = doc.internal.pageSize.getWidth();   // 210
    const H = doc.internal.pageSize.getHeight();   // 297
    const M = 15; // margin
    const CW = W - 2 * M; // content width
    let y = M;

    // ── Colors ──
    const darkBg = [15, 23, 42];    // slate-900
    const gold = [245, 166, 35];
    const green = [34, 197, 94];
    const red = [239, 68, 68];
    const white = [255, 255, 255];
    const gray = [148, 163, 184];
    const lightGray = [226, 232, 240];
    const darkText = [30, 41, 59];

    // ── Helper: Section Title ──
    function sectionTitle(text) {
      doc.setFontSize(13);
      doc.setTextColor(...gold);
      doc.setFont('helvetica', 'bold');
      doc.text(text, M, y);
      y += 2;
      doc.setDrawColor(...gold);
      doc.setLineWidth(0.5);
      doc.line(M, y, W - M, y);
      y += 6;
    }

    // ── Helper: Key-Value Row ──
    function kvRow(label, value, opts = {}) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...gray);
      doc.text(label, M + 2, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...(opts.color || darkText));
      doc.text(String(value), W - M - 2, y, { align: 'right' });
      y += 5;
    }

    // ── Helper: check new page ──
    function checkPage(needed = 20) {
      if (y + needed > H - M) {
        doc.addPage();
        y = M;
      }
    }

    // ═══════════════════════════════════════
    // PAGE 1: Cover + Inputs + Key Metrics
    // ═══════════════════════════════════════

    // Header bar
    doc.setFillColor(...darkBg);
    doc.rect(0, 0, W, 28, 'F');
    doc.setFontSize(20);
    doc.setTextColor(...gold);
    doc.setFont('helvetica', 'bold');
    doc.text('ImmoGame — Deal-Exposé', M, 16);
    doc.setFontSize(9);
    doc.setTextColor(...gray);
    doc.setFont('helvetica', 'normal');
    const dateStr = new Date().toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' });
    doc.text(`Erstellt am ${dateStr}`, W - M, 16, { align: 'right' });
    y = 36;

    // ── Section: Objektdaten (User Inputs) ──
    sectionTitle('Objektdaten & Finanzierung');

    const grunderwerbsteuer = params.bundesland ? 
      (BUNDESLAENDER[params.bundesland]?.grunderwerbsteuer || 0) : 0;

    const inputsLeft = [
      ['Kaufpreis', fmt.eur(params.kaufpreis)],
      ['Kaltmiete / Monat', fmt.eur(params.kaltmiete)],
      ['Hausgeld / Monat', fmt.eur(params.hausgeld)],
      ['Wohnfläche', ($('dd-wohnflaeche')?.value || '—') + ' m²'],
      ['Baujahr', String(params.baujahr)],
      ['Bundesland', params.bundesland || '—'],
      ['Gebäudeanteil', fmt.pct(params.gebaeudeantelil)],
    ];
    const inputsRight = [
      ['Eigenkapital', fmt.pct(params.eigenkapitalProzent)],
      ['Zinssatz', fmt.pct(params.zinssatz)],
      ['Tilgungssatz', fmt.pct(params.tilgungssatz)],
      ['Zinsbindung', params.zinsbindung + ' Jahre'],
      ['Sondertilgung / Jahr', fmt.eur(params.sondertilgung)],
      ['Maklerkosten', fmt.pct(params.maklerkosten)],
      ['Modernisierung', fmt.eur(params.modernisierungskosten)],
    ];

    const startY = y;
    // Left column
    inputsLeft.forEach(([label, value]) => {
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...gray);
      doc.text(label, M + 2, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...darkText);
      doc.text(value, M + CW / 2 - 5, y, { align: 'right' });
      y += 4.5;
    });

    // Right column
    y = startY;
    inputsRight.forEach(([label, value]) => {
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...gray);
      doc.text(label, M + CW / 2 + 5, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...darkText);
      doc.text(value, W - M - 2, y, { align: 'right' });
      y += 4.5;
    });

    y = startY + Math.max(inputsLeft.length, inputsRight.length) * 4.5 + 6;

    // Additional inputs row
    const extraInputs = [
      ['Nicht-umlagefähig', fmt.pct(params.nichtUmlagefaehigProzent)],
      ['Verwaltungskosten/Mon.', fmt.eur(params.verwaltungskostenMonat)],
      ['Leerstandswagnis', fmt.pct(params.leerstandswagnis)],
      ['Mietsteigerung p.a.', fmt.pct(params.mietsteigerungPa)],
      ['Grenzsteuersatz', fmt.pct(params.grenzsteuersatz)],
      ['Grundsteuer / Jahr', fmt.eur(params.grundsteuerJahr)],
      ['Wertsteigerung p.a.', fmt.pct(params.wertsteigerungPa)],
    ];
    
    // Print as two-column layout
    const extraLeft = extraInputs.slice(0, 4);
    const extraRight = extraInputs.slice(4);
    const extraStartY = y;
    extraLeft.forEach(([label, value]) => {
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...gray);
      doc.text(label, M + 2, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...darkText);
      doc.text(value, M + CW / 2 - 5, y, { align: 'right' });
      y += 4.5;
    });
    y = extraStartY;
    extraRight.forEach(([label, value]) => {
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...gray);
      doc.text(label, M + CW / 2 + 5, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...darkText);
      doc.text(value, W - M - 2, y, { align: 'right' });
      y += 4.5;
    });
    y = extraStartY + Math.max(extraLeft.length, extraRight.length) * 4.5 + 8;

    // ── Section: Key Performance Indicators ──
    sectionTitle('Kennzahlen');

    // KPI boxes
    const kpis = [
      { label: 'Bruttomietrendite', value: fmt.pct(result.bruttoMietrendite), color: darkText },
      { label: 'Nettomietrendite', value: fmt.pct(result.nettoMietrendite), color: darkText },
      { label: 'Kaufpreisfaktor', value: fmt.num(result.kaufpreisfaktor, 1) + 'x', color: darkText },
      { label: 'Cashflow / Monat', value: fmt.eur(result.cashflowVorSteuernMonat), color: result.cashflowVorSteuernMonat >= 0 ? green : red },
      { label: 'IRR (10 Jahre)', value: fmt.pct(result.simulation.exit.irr), color: result.simulation.exit.irr >= 5 ? green : gold },
      { label: 'EK-Multiple', value: fmt.num(result.simulation.exit.eigenkapitalMultiple, 2) + 'x', color: result.simulation.exit.eigenkapitalMultiple >= 2 ? green : darkText },
      { label: 'AfA / Jahr', value: fmt.eur(result.afaJahr), color: darkText },
      { label: 'EK-Rendite p.a.', value: fmt.pct(result.simulation.exit.ekRenditeNachVerkauf), color: result.simulation.exit.ekRenditeNachVerkauf >= 5 ? green : darkText },
    ];

    const boxW = (CW - 12) / 4;
    const boxH = 18;
    kpis.forEach((kpi, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const bx = M + col * (boxW + 4);
      const by = y + row * (boxH + 4);

      // Box background
      doc.setFillColor(241, 245, 249); // slate-100
      doc.roundedRect(bx, by, boxW, boxH, 2, 2, 'F');

      // Label
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...gray);
      doc.text(kpi.label, bx + boxW / 2, by + 6, { align: 'center' });

      // Value
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...kpi.color);
      doc.text(kpi.value, bx + boxW / 2, by + 14, { align: 'center' });
    });

    y += Math.ceil(kpis.length / 4) * (boxH + 4) + 8;

    // ═══════════════════════════════════════
    // PAGE 2: Charts
    // ═══════════════════════════════════════
    doc.addPage();
    y = M;

    // Cashflow Chart
    sectionTitle('Cashflow-Entwicklung (10 Jahre)');
    if (cashflowChart) {
      const cfImg = $('dd-cashflow-chart').toDataURL('image/png');
      const imgH = CW * 0.45;
      doc.addImage(cfImg, 'PNG', M, y, CW, imgH);
      y += imgH + 10;
    }

    // Wealth Chart
    checkPage(80);
    sectionTitle('Vermögensentwicklung');
    if (wealthChart) {
      const wImg = $('dd-wealth-chart').toDataURL('image/png');
      const imgH = CW * 0.45;
      doc.addImage(wImg, 'PNG', M, y, CW, imgH);
      y += imgH + 10;
    }

    // ═══════════════════════════════════════
    // PAGE 3: Exit Scenario + Annuitätenplan
    // ═══════════════════════════════════════
    doc.addPage();
    y = M;

    sectionTitle('Exit-Szenario nach 10 Jahren');
    const exit = result.simulation.exit;
    const exitRows = [
      ['Geschätzter Verkaufspreis', fmt.eur(exit.verkaufspreis)],
      ['Restschuld', '-' + fmt.eur(exit.restschuld)],
      ['Verkaufsnebenkosten (~2%)', '-' + fmt.eur(exit.verkaufsNebenkosten)],
      ['Netto-Verkaufserlös', fmt.eur(exit.nettoVerkaufserloes)],
      ['Kumulierter Cashflow', fmt.eur(exit.kumulierterCashflow)],
      ['Eigenkapital eingesetzt', '-' + fmt.eur(exit.eigenkapitalEingesetzt)],
    ];
    exitRows.forEach(([label, value]) => kvRow(label, value));

    y += 4;
    // Highlighted totals — dynamically sized box
    const highlightRows = [
      ['Gesamtgewinn', fmt.eur(exit.gesamtgewinn), green],
      ['EK-Rendite p.a. (nach Verkauf)', fmt.pct(exit.ekRenditeNachVerkauf), green],
      ['IRR (Interner Zinsfuß)', fmt.pct(exit.irr), green],
      ['Eigenkapital-Multiple', exit.eigenkapitalMultiple + 'x', green],
    ];
    const boxPadV = 5;   // vertical padding top & bottom inside box
    const rowH = 5.5;    // height per row
    const boxHeight = boxPadV * 2 + highlightRows.length * rowH;

    doc.setFillColor(241, 245, 249);
    doc.roundedRect(M, y, CW, boxHeight, 2, 2, 'F');
    y += boxPadV;
    highlightRows.forEach(([label, value, color]) => {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text(label, M + 5, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...color);
      doc.text(String(value), W - M - 5, y, { align: 'right' });
      y += rowH;
    });
    y += boxPadV + 4; // padding after box

    // ── Annuitätenplan ──
    checkPage(40);
    sectionTitle('Annuitätenplan');

    const years = result.simulation.years;
    const headers = ['Jahr', 'Jahresmiete', 'Zinsen', 'Tilgung', 'Restschuld', 'CF vor St.', 'CF nach St.', 'Kumuliert'];
    const colWidths = [14, 24, 22, 22, 26, 22, 24, 24];
    
    // Header row
    doc.setFillColor(...darkBg);
    doc.rect(M, y - 3.5, CW, 6, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...white);
    let x = M + 1;
    headers.forEach((h, i) => {
      doc.text(h, x + (i === 0 ? 0 : colWidths[i] - 2), y, { align: i === 0 ? 'left' : 'right' });
      x += colWidths[i];
    });
    y += 5;

    // Data rows
    years.forEach((yr, idx) => {
      checkPage(6);
      if (idx % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(M, y - 3.5, CW, 5, 'F');
      }
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...darkText);

      const row = [
        'Jahr ' + yr.jahr,
        fmt.eur(yr.jahresmiete),
        fmt.eur(yr.zinsenJahr),
        fmt.eur(yr.tilgungJahr),
        fmt.eur(yr.restschuld),
        fmt.eur(yr.cashflowVorSteuern),
        fmt.eur(yr.cashflowNachSteuern),
        fmt.eur(yr.kumulierterCashflow),
      ];

      x = M + 1;
      row.forEach((val, i) => {
        // Color cashflow values
        if (i >= 5) {
          const numVal = [yr.cashflowVorSteuern, yr.cashflowNachSteuern, yr.kumulierterCashflow][i - 5];
          doc.setTextColor(...(numVal >= 0 ? green : red));
        } else {
          doc.setTextColor(...darkText);
        }
        doc.text(val, x + (i === 0 ? 0 : colWidths[i] - 2), y, { align: i === 0 ? 'left' : 'right' });
        x += colWidths[i];
      });
      y += 5;
    });

    // ── Footer on all pages ──
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...gray);
      doc.text(`ImmoGame — Seite ${p} / ${totalPages}`, W / 2, H - 7, { align: 'center' });
      doc.setDrawColor(...lightGray);
      doc.setLineWidth(0.2);
      doc.line(M, H - 12, W - M, H - 12);
    }

    // ── Filename & Download ──
    let dealName = $('save-deal-name')?.value?.trim();
    if (!dealName) {
      dealName = `ImmoGame_${params.kaufpreis}`;
    }
    const filename = `${dealName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_expose.pdf`;

    // Safari does not support the 'download' attribute on blob/data URIs.
    // Detect Safari and use different strategies.
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    if (isSafari) {
      // Safari: Open PDF in new tab using native PDF viewer.
      // User can save with Cmd+S from there.
      const pdfBlob = new Blob([doc.output('arraybuffer')], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(pdfBlob);
      window.open(blobUrl, '_blank');
      showToast('PDF wird im neuen Tab angezeigt — speichere mit ⌘S');
    } else {
      // Chrome/Firefox: Direct download works perfectly with blob URLs.
      const pdfBlob = new Blob([doc.output('arraybuffer')], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      }, 250);
      showToast('PDF erfolgreich erstellt ✓');
    }

  } catch (error) {
    console.error('PDF Export Error:', error);
    showToast('Fehler beim PDF Export');
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}
