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
    if (error.code === '42P01' || error.code === 'PGRST205' || /editorial_programmes/i.test(error.message || '')) return new Error('Studio schema is missing. Run supabase/005_kinosis_0453.sql once.');
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



  function programmeFromRow(row) {
    if (!row) return null;
    const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
    return { ...payload, slug: row.slug || payload.slug, status: row.status || payload.status || 'draft', updatedAt: row.updated_at || payload.updatedAt || null };
  }

  function programmeSummaryFromRow(row) {
    if (!row) return null;
    const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
    return {
      slug: row.slug || payload.slug,
      kind: row.kind || payload.kind || 'editorial',
      surface: row.surface || payload.surface || 'arthouse',
      status: row.status || payload.status || 'draft',
      priority: Number(row.priority ?? payload.priority ?? 100),
      title: row.title || payload.title || '',
      description: row.description || payload.description || '',
      updatedAt: row.updated_at || payload.updatedAt || null,
      _summaryOnly: !row.payload,
      ...(row.payload ? { payload } : {}),
    };
  }

  async function readPublishedProgrammes() {
    const c = create();
    const { data, error } = await c.rpc('kinosis_public_programmes');
    if (error) {
      // Studio is optional. Older deployments keep using Git-authored curations.
      if (error.code === '42883' || error.code === 'PGRST202' || error.code === 'PGRST205' || /kinosis_public_programmes|editorial_programmes/i.test(error.message || '')) return [];
      throw dbError(error);
    }
    return (data || []).map(programmeFromRow).filter(Boolean);
  }

  async function readStudioProgrammes() {
    if (!isAuthenticated()) throw new Error('Sign in required.');
    const c = create();
    // 0.4.5.4 list view intentionally avoids downloading full JSON payloads.
    let query = await c.from('editorial_programmes').select('slug,kind,surface,status,priority,title,description,updated_at').order('priority', { ascending: true });
    if (query.error && /column .*title|description.*does not exist/i.test(query.error.message || '')) {
      // Backward-compatible fallback until supabase/006_kinosis_0454.sql is run.
      query = await c.from('editorial_programmes').select('slug,kind,surface,status,priority,payload,updated_at').order('priority', { ascending: true });
    }
    if (query.error) throw dbError(query.error);
    return (query.data || []).map(programmeSummaryFromRow).filter(Boolean);
  }

  async function readStudioProgramme(slug) {
    if (!isAuthenticated()) throw new Error('Sign in required.');
    const c = create();
    const { data, error } = await c.from('editorial_programmes').select('slug,kind,surface,status,priority,payload,updated_at').eq('slug', String(slug || '')).maybeSingle();
    if (error) throw dbError(error);
    return programmeFromRow(data);
  }

  async function saveStudioProgramme(programme, status = 'draft') {
    if (!isAuthenticated()) throw new Error('Sign in required.');
    const slug = String(programme?.slug || '').trim();
    if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(slug)) throw new Error('유효한 slug가 필요합니다.');
    const c = create();
    const payload = { ...programme, slug, status };
    const row = {
      slug,
      kind: programme.kind === 'director-archive' ? 'director-archive' : 'editorial',
      surface: programme.surface === 'discover' || programme.surface === 'both' ? programme.surface : 'arthouse',
      status: ['draft', 'published', 'archived'].includes(status) ? status : 'draft',
      priority: Number.isFinite(Number(programme.priority)) ? Math.trunc(Number(programme.priority)) : 100,
      title: String(programme.title || '').slice(0, 160),
      description: String(programme.description || '').slice(0, 1000),
      payload,
      updated_by: user().id,
      updated_at: new Date().toISOString(),
    };
    let result = await c.from('editorial_programmes').upsert(row, { onConflict: 'slug' }).select('slug,status,payload,updated_at').single();
    if (result.error && /column .*title|description.*does not exist/i.test(result.error.message || '')) {
      const legacyRow = { ...row }; delete legacyRow.title; delete legacyRow.description;
      result = await c.from('editorial_programmes').upsert(legacyRow, { onConflict: 'slug' }).select('slug,status,payload,updated_at').single();
    }
    if (result.error) throw dbError(result.error);
    return programmeFromRow(result.data);
  }

  async function archiveStudioProgramme(slug) {
    if (!isAuthenticated()) throw new Error('Sign in required.');
    const c = create();
    const { data, error } = await c.from('editorial_programmes').update({ status: 'archived', updated_by: user().id, updated_at: new Date().toISOString() }).eq('slug', String(slug || '')).select('slug,status,payload,updated_at').single();
    if (error) throw dbError(error);
    return programmeFromRow(data);
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
    readPublishedProgrammes,
    readStudioProgrammes,
    readStudioProgramme,
    saveStudioProgramme,
    archiveStudioProgramme,
    health,
    redirectUrl,
  });
})();
