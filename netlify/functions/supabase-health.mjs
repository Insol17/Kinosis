const SUPABASE_URL = process.env.SUPABASE_URL || 'https://uqntdtjqeernzqpbymex.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_lEWx9szNW7vSaXnPL1zd1g_WRW-FGZq';

export default async () => {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/app_health?select=id,label&limit=1`, {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        Accept: 'application/json',
        'X-Client-Info': 'kinosis-health/0.4.1'
      },
      cache: 'no-store'
    });
    if (!response.ok) {
      const body = await response.text();
      console.error('KINOSIS Supabase health check failed', response.status, body.slice(0,240));
      return new Response('degraded', { status: 503 });
    }
    console.log('KINOSIS Supabase health check OK', new Date().toISOString());
    return new Response('ok', { status: 200 });
  } catch (error) {
    console.error('KINOSIS Supabase health exception', error);
    return new Response('degraded', { status: 503 });
  }
};

// 00:17, 08:17, 16:17 UTC = 09:17, 17:17, 01:17 KST.
export const config = {
  schedule: '17 0,8,16 * * *'
};
