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

const randomCharacter = (characters: string) => {
  const random = new Uint32Array(1);
  crypto.getRandomValues(random);
  return characters[random[0] % characters.length];
};

const generateTemporaryPassword = () => {
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowercase = 'abcdefghijkmnopqrstuvwxyz';
  const numbers = '23456789';
  const symbols = '!@#$%';
  const all = `${uppercase}${lowercase}${numbers}${symbols}`;

  const characters = [
    randomCharacter(uppercase),
    randomCharacter(lowercase),
    randomCharacter(numbers),
    randomCharacter(symbols),
  ];

  while (characters.length < 12) {
    characters.push(randomCharacter(all));
  }

  for (let index = characters.length - 1; index > 0; index -= 1) {
    const random = new Uint32Array(1);
    crypto.getRandomValues(random);
    const target = random[0] % (index + 1);
    [characters[index], characters[target]] = [
      characters[target],
      characters[index],
    ];
  }

  return characters.join('');
};

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
      { error: '관리자만 비밀번호를 초기화할 수 있습니다.' },
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

  const { data: workerProfile, error: workerProfileError } = await adminClient
    .from('profiles')
    .select('login_id, name, role, is_active, must_change_password')
    .eq('id', workerId)
    .single();

  if (workerProfileError || !workerProfile) {
    return jsonResponse({ error: '작업자 계정을 찾을 수 없습니다.' }, 404);
  }

  if (workerProfile.role !== 'worker') {
    return jsonResponse(
      { error: '관리자 계정의 비밀번호는 여기서 초기화할 수 없습니다.' },
      400,
    );
  }

  if (workerProfile.is_active !== true) {
    return jsonResponse({ error: '비활성화된 작업자 계정입니다.' }, 400);
  }

  const { error: flagError } = await adminClient
    .from('profiles')
    .update({ must_change_password: true })
    .eq('id', workerId);

  if (flagError) {
    return jsonResponse(
      { error: '비밀번호 변경 상태를 업데이트하지 못했습니다.' },
      500,
    );
  }

  const temporaryPassword = generateTemporaryPassword();
  const { error: passwordError } =
    await adminClient.auth.admin.updateUserById(workerId, {
      password: temporaryPassword,
    });

  if (passwordError) {
    await adminClient
      .from('profiles')
      .update({
        must_change_password: workerProfile.must_change_password,
      })
      .eq('id', workerId);

    return jsonResponse({ error: '비밀번호를 초기화하지 못했습니다.' }, 500);
  }

  return jsonResponse({
    worker: {
      id: workerId,
      loginId: workerProfile.login_id,
      name: workerProfile.name,
    },
    temporaryPassword,
  });
});
