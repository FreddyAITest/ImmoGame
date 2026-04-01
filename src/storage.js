// ============================================================
// ImmoGame — Storage Layer (Supabase + localStorage Fallback)
// ============================================================

import { supabase, getSession } from './auth.js';

const STORAGE_KEY = 'immogame_deals';

// ── Supabase connectivity check ──────────────────────────
let supabaseAvailable = null; // null = unknown, true/false once checked

async function checkSupabase() {
  if (supabaseAvailable !== null) return supabaseAvailable;
  if (!supabase) {
    supabaseAvailable = false;
    return false;
  }
  
  try {
    const { data, error } = await supabase.from('deals').select('id').limit(1);
    if (error && error.code === '42P01') {
      // 42P01: relation "deals" does not exist
      console.warn('[ImmoGame] Supabase Tabelle "deals" nicht gefunden. Verwende localStorage.');
      supabaseAvailable = false;
    } else {
      supabaseAvailable = true;
    }
    return supabaseAvailable;
  } catch (e) {
    console.warn('[ImmoGame] Supabase nicht erreichbar. Verwende localStorage.', e);
    supabaseAvailable = false;
    return false;
  }
}

// Initialize check on module load
checkSupabase();

// ══════════════════════════════════════════════════════════
// SUPABASE OPERATIONS
// ══════════════════════════════════════════════════════════

async function authUserId() {
  const session = await getSession();
  return session?.user?.id || null;
}

async function supabaseGetAll() {
  // RLS (Row Level Security) handles filtering by user if configured,
  // but we can also explicitly filter just in case.
  const uid = await authUserId();
  
  let query = supabase.from('deals').select('*').order('created_at', { ascending: false });
  // If no UID is available, we rely on RLS (if strict, it will return nothing).
  
  const { data, error } = await query;
  if (error) throw new Error(`Supabase GET failed: ${error.message}`);
  
  // Map to our internal format
  return data.map(r => ({
    id: r.id,
    name: r.name,
    params: r.params,
    results: r.results,
    date: r.created_at,
  }));
}

async function supabaseSave(name, params, results) {
  const uid = await authUserId();
  
  const payload = { 
    name, 
    params, 
    results 
  };
  
  // Only append user_id if we have one (to support generic table testing if RLS is off)
  if (uid) {
    payload.user_id = uid;
  }

  const { data, error } = await supabase.from('deals').insert([payload]).select();
  if (error) throw new Error(`Supabase POST failed: ${error.message}`);
  return data[0];
}

async function supabaseDelete(id) {
  const { error } = await supabase.from('deals').delete().eq('id', id);
  if (error) throw new Error(`Supabase DELETE failed: ${error.message}`);
}

async function supabaseGetOne(id) {
  const { data, error } = await supabase.from('deals').select('*').eq('id', id);
  if (error) throw new Error(`Supabase GET one failed: ${error.message}`);
  if (!data || !data.length) return null;
  const r = data[0];
  return { id: r.id, name: r.name, params: r.params, results: r.results, date: r.created_at };
}

// ══════════════════════════════════════════════════════════
// LOCAL STORAGE OPERATIONS
// ══════════════════════════════════════════════════════════

function localGetAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function localSave(name, params, results) {
  const deals = localGetAll();
  const deal = {
    id: crypto.randomUUID(),
    name,
    params,
    results,
    date: new Date().toISOString(),
  };
  deals.unshift(deal);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(deals));
  return deal;
}

function localDelete(id) {
  const deals = localGetAll().filter(d => d.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(deals));
}

function localGetOne(id) {
  return localGetAll().find(d => d.id === id) || null;
}

// ══════════════════════════════════════════════════════════
// PUBLIC API (async-first, falls back to localStorage)
// ══════════════════════════════════════════════════════════

export async function saveDeal(name, params, results) {
  const ok = await checkSupabase();
  if (ok) {
    try {
      const row = await supabaseSave(name, params, results);
      // Also save locally as backup
      localSave(name, params, results);
      return row;
    } catch (e) {
      console.error('[ImmoGame] Supabase save fehlgeschlagen, speichere lokal:', e);
      return localSave(name, params, results);
    }
  }
  return localSave(name, params, results);
}

export async function getAllDeals() {
  const ok = await checkSupabase();
  if (ok) {
    try {
      return await supabaseGetAll();
    } catch (e) {
      console.error('[ImmoGame] Supabase getAllDeals fehlgeschlagen, lade lokal:', e);
      return localGetAll();
    }
  }
  return localGetAll();
}

export async function deleteDeal(id) {
  const ok = await checkSupabase();
  if (ok) {
    try {
      await supabaseDelete(id);
    } catch (e) {
      console.error('[ImmoGame] Supabase delete fehlgeschlagen:', e);
    }
  }
  localDelete(id);
}

export async function loadDeal(id) {
  const ok = await checkSupabase();
  if (ok) {
    try {
      const deal = await supabaseGetOne(id);
      if (deal) return deal;
    } catch (e) {
      console.error('[ImmoGame] Supabase loadDeal fehlgeschlagen:', e);
    }
  }
  return localGetOne(id);
}

export function exportDeals() {
  // Export always uses local deals (fast, synchronous)
  return JSON.stringify(localGetAll(), null, 2);
}

export async function importDeals(jsonString) {
  const data = JSON.parse(jsonString);
  if (!Array.isArray(data)) throw new Error('Ungültiges Format');

  const uid = await authUserId();
  const existing = localGetAll();
  const existingIds = new Set(existing.map(d => d.id));
  let count = 0;

  for (const d of data) {
    if (!existingIds.has(d.id)) {
      existing.push(d);
      count++;
      // Also push to Supabase if available (fire-and-forget)
      if (supabaseAvailable) {
        const payload = {
          id: d.id,
          name: d.name,
          params: d.params || {},
          results: d.results || {},
        };
        if (uid) payload.user_id = uid;
        supabase.from('deals').insert([payload]).then(); // fire and forget
      }
    }
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  return count;
}

// ── Connection Status Helper ─────────────────────────────
export async function getConnectionStatus() {
  const ok = await checkSupabase();
  return ok ? 'supabase' : 'local';
}
