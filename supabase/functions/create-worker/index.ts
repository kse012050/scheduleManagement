import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const loginIdPattern = /^[a-z0-9][a-z0-9._-]{2,31}$/;

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

  const authorization = request.headers.get('Authorization');
  const accessToken = authorization?.replace(/^Bearer\s+/i, '');

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
    error: userError,
  } = await adminClient.auth.getUser(accessToken);

  if (userError || !requester) {
    return jsonResponse({ error: '유효하지 않은 로그인입니다.' }, 401);
  }

  const { data: requesterProfile, error: profileError } = await adminClient
    .from('profiles')
    .select('role, is_active')
    .eq('id', requester.id)
    .single();

  if (
    profileError ||
    requesterProfile?.role !== 'admin' ||
    requesterProfile?.is_active !== true
  ) {
    return jsonResponse(
      { error: '관리자만 작업자를 생성할 수 있습니다.' },
      403,
    );
  }

  let payload: { loginId?: unknown; name?: unknown };
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: '요청 형식이 올바르지 않습니다.' }, 400);
  }

  const loginId =
    typeof payload.loginId === 'string'
      ? payload.loginId.trim().toLowerCase()
      : '';
  const name = typeof payload.name === 'string' ? payload.name.trim() : '';

  if (!loginIdPattern.test(loginId)) {
    return jsonResponse(
      {
        error:
          '아이디는 영문 소문자 또는 숫자로 시작하는 3~32자로 입력해주세요.',
      },
      400,
    );
  }

  if (!name || name.length > 50) {
    return jsonResponse(
      { error: '이름은 1~50자로 입력해주세요.' },
      400,
    );
  }

  const { data: existingProfile, error: duplicateCheckError } =
    await adminClient
      .from('profiles')
      .select('id')
      .eq('login_id', loginId)
      .maybeSingle();

  if (duplicateCheckError) {
    return jsonResponse({ error: '아이디 중복 확인에 실패했습니다.' }, 500);
  }

  if (existingProfile) {
    return jsonResponse({ error: '이미 사용 중인 아이디입니다.' }, 409);
  }

  const temporaryPassword = generateTemporaryPassword();
  const { data: createdUser, error: createError } =
    await adminClient.auth.admin.createUser({
      email: `${loginId}@login.local`,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        login_id: loginId,
        name,
      },
    });

  if (createError || !createdUser.user) {
    const duplicate =
      createError?.message.toLowerCase().includes('already') ?? false;
    return jsonResponse(
      {
        error: duplicate
          ? '이미 사용 중인 아이디입니다.'
          : '작업자 계정을 생성하지 못했습니다.',
      },
      duplicate ? 409 : 500,
    );
  }

  return jsonResponse(
    {
      worker: {
        id: createdUser.user.id,
        loginId,
        name,
      },
      temporaryPassword,
    },
    201,
  );
});
