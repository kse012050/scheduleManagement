import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const phonePattern = /^01[016789][0-9]{7,8}$/;

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: '허용되지 않은 요청입니다.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: '서버 인증 설정이 없습니다.' }, 500);
  }

  const accessToken = request.headers
    .get('Authorization')
    ?.replace(/^Bearer\s+/i, '');
  if (!accessToken) {
    return jsonResponse({ error: '로그인이 필요합니다.' }, 401);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const {
    data: { user: requester },
    error: requesterError,
  } = await adminClient.auth.getUser(accessToken);
  if (requesterError || !requester) {
    return jsonResponse({ error: '유효하지 않은 로그인입니다.' }, 401);
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('role, is_active')
    .eq('id', requester.id)
    .single();
  if (
    profileError ||
    profile?.role !== 'admin' ||
    profile?.is_active !== true
  ) {
    return jsonResponse({ error: '관리자만 전화번호를 변경할 수 있습니다.' }, 403);
  }

  let payload: { phone?: unknown };
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: '요청 형식이 올바르지 않습니다.' }, 400);
  }

  const phone =
    typeof payload.phone === 'string'
      ? payload.phone.replace(/[^0-9]/g, '')
      : '';
  if (!phonePattern.test(phone)) {
    return jsonResponse({ error: '전화번호를 올바르게 입력해주세요.' }, 400);
  }

  const { error: updateError } = await adminClient
    .from('profiles')
    .update({ phone })
    .eq('id', requester.id);
  if (updateError) {
    return jsonResponse({ error: '전화번호를 변경하지 못했습니다.' }, 500);
  }

  return jsonResponse({ phone });
});
