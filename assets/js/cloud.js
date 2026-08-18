(function () {
  'use strict';

  const cfg = window.KINOSIS_CONFIG || {};
  const listeners = new Set();
  let client = null;
  let session = null;
  let readyPromise = null;
  let lastError = null;

  function emit(event) {
    for (const fn of listeners) {
      try { fn({ event, session, user: session?.user || null, error: lastError }); } catch {}
    }
  }

  function redirectUrl() {
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return `${location.origin}${location.pathname}`;
    return cfg.authRedirectUrl || `${location.origin}${location.pathname}`;
  }

  function create() {
    if (client) return client;
    if (!window.supabase?.createClient) throw new Error('Supabase client library failed to load.');
    if (!cfg.supabaseUrl || !cfg.supabasePublishableKey) throw new Error('Supabase public configuration is missing.');
    client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
      global: { headers: { 'X-Client-Info': `kinosis/${cfg.version || 'dev'}` } },
    });
    client.auth.onAuthStateChange((event, next) => {
      session = next || null;
      lastError = null;
      emit(event);
    });
    return client;
  }

  async function init() {
    if (readyPromise) return readyPromise;
    readyPromise = (async () => {
      try {
        const c = create();
        const { data, error } = await c.auth.getSession();
        if (error) throw error;
        session = data.session || null;
        emit('INITIAL_SESSION');
      } catch (error) {
        lastError = error;
        emit('ERROR');
      }
      return { session, user: session?.user || null, error: lastError };
    })();
    return readyPromise;
  }

  function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  function isAuthenticated() { return !!session?.user; }
  function user() { return session?.user || null; }
  function accessToken() { return session?.access_token || null; }

  async function signInOAuth(provider) {
    const c = create();
    const { error } = await c.auth.signInWithOAuth({ provider, options: { redirectTo: redirectUrl() } });
    if (error) throw error;
  }

  async function sendMagicLink(email) {
    const c = create();
    const { error } = await c.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectUrl(), shouldCreateUser: true } });
    if (error) throw error;
  }

  async function signOut() {
    const c = create();
    const { error } = await c.auth.signOut();
    if (error) throw error;
  }

  function dbError(error) {
    if (!error) return new Error('Unknown cloud error.');
    if (error.code === '42P01' || /user_state.*does not exist/i.test(error.message || '')) return new Error('Cloud schema is missing. Run supabase/SETUP_ALL.sql once.');
    if (error.code === '42883' || /kinosis_write_user_state/i.test(error.message || '')) return new Error('Cloud schema is outdated. Run supabase/004_kinosis_0443.sql once.');
    if (error.code === '42501') return new Error('Cloud permission denied. Check Supabase RLS policies.');
    return error;
  }

  async function readUserState() {
    if (!isAuthenticated()) return null;
    const c = create();
    const { data, error } = await c.from('user_state').select('payload,updated_at,revision').eq('user_id', user().id).maybeSingle();
    if (error) throw dbError(error);
    return data || null;
  }

  async function writeUserState(payload, expectedRevision = 0) {
    if (!isAuthenticated()) throw new Error('Sign in required.');
    const c = create();
    const { data, error } = await c.rpc('kinosis_write_user_state', {
      expected_revision: Number(expectedRevision || 0),
      new_payload: payload,
    });
    if (error) throw dbError(error);
    return data || null;
  }

  async function health() {
    const c = create();
    const { data, error } = await c.from('app_health').select('id').limit(1);
    if (error) throw error;
    return data;
  }

  window.KINOSIS_CLOUD = Object.freeze({
    init,
    onChange,
    isAuthenticated,
    user,
    accessToken,
    signInOAuth,
    sendMagicLink,
    signOut,
    readUserState,
    writeUserState,
    health,
    redirectUrl,
  });
})();
