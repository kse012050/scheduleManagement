import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
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
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const {
    data: { user: requester },
    error: requesterError,
  } = await adminClient.auth.getUser(accessToken);

  if (requesterError || !requester) {
    return jsonResponse({ error: '유효하지 않은 로그인입니다.' }, 401);
  }

  const { data: requesterProfile, error: requesterProfileError } =
    await adminClient
      .from('profiles')
      .select('role, is_active')
      .eq('id', requester.id)
      .single();

  if (requesterProfileError) {
    return jsonResponse(
      { error: '관리자 권한을 확인하지 못했습니다.' },
      500,
    );
  }

  if (
    requesterProfile.role !== 'admin' ||
    requesterProfile.is_active !== true
  ) {
    return jsonResponse(
      { error: '관리자만 작업자를 삭제할 수 있습니다.' },
      403,
    );
  }

  let payload: { workerId?: unknown };
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: '요청 형식이 올바르지 않습니다.' }, 400);
  }

  const workerId =
    typeof payload.workerId === 'string' ? payload.workerId.trim() : '';

  if (!uuidPattern.test(workerId)) {
    return jsonResponse({ error: '작업자 ID가 올바르지 않습니다.' }, 400);
  }

  if (workerId === requester.id) {
    return jsonResponse(
      { error: '현재 로그인한 관리자 계정은 삭제할 수 없습니다.' },
      400,
    );
  }

  const { data: workerProfile, error: workerProfileError } = await adminClient
    .from('profiles')
    .select('login_id, name, role')
    .eq('id', workerId)
    .single();

  if (workerProfileError || !workerProfile) {
    return jsonResponse({ error: '작업자 계정을 찾을 수 없습니다.' }, 404);
  }

  if (workerProfile.role !== 'worker') {
    return jsonResponse({ error: '관리자 계정은 삭제할 수 없습니다.' }, 400);
  }

  const { error: deleteError } =
    await adminClient.auth.admin.deleteUser(workerId, false);

  if (deleteError) {
    return jsonResponse({ error: '작업자 계정을 삭제하지 못했습니다.' }, 500);
  }

  return jsonResponse({
    deleted: true,
    worker: {
      id: workerId,
      loginId: workerProfile.login_id,
      name: workerProfile.name,
    },
  });
});
