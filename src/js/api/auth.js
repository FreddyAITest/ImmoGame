// ============================================================
// ImmoGame — Authentication Layer
// ============================================================

export const SUPABASE_URL = 'https://zxuxetkfxgwyvxbcyshc.supabase.co';
// WARNING: This should be your 'anon' public key. Do not use the service_role key here in production!
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4dXhldGtmeGd3eXZ4YmN5c2hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NjU4NjEsImV4cCI6MjA5MDU0MTg2MX0.WuzDNKLtmg_4DSh9soYB8PZj01hWlsnxPipwqHbQ92E';

// Initialize Supabase Client globally using the CDN script
// window.supabase is available from https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2
export const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// ── Authentication Methods ─────────────────────────────────

export async function signIn(provider) {
  if (!supabase) {
    console.error("Supabase client nicht initialisiert.");
    return false;
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: provider,
    options: {
      redirectTo: window.location.origin
    }
  });

  if (error) {
    console.error('Login Fehler:', error.message);
    return false;
  }
  return true;
}

export async function signOut() {
  if (!supabase) return false;
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Logout Fehler:', error.message);
    return false;
  }
  return true;
}

export async function getUser() {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getSession() {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export function onAuthStateChange(callback) {
  if (!supabase) return null;
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
  return data.subscription;
}
