import { createClient } from '@supabase/supabase-js';

function response(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

export default async (request) => {
  if (request.method !== 'POST') return response({ error: 'Method not allowed.' }, 405);
  const url = process.env.SUPABASE_URL?.trim();
  const publishable = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !publishable || !secret) return response({ error: 'Account deletion is not configured on the server.' }, 503);

  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return response({ error: 'Authentication required.' }, 401);

  try {
    const userClient = createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData?.user) return response({ error: 'Invalid or expired session.' }, 401);

    const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { error } = await admin.auth.admin.deleteUser(userData.user.id, false);
    if (error) throw error;
    return response({ ok: true });
  } catch (error) {
    console.error('delete-account:', error.message);
    return response({ error: 'Account deletion failed.' }, 500);
  }
};

export const config = { path: '/api/delete-account', method: 'POST',
  rateLimit: { action: 'rate_limit', aggregateBy: ['ip'], windowSize: 60, windowLimit: 6 }
};
