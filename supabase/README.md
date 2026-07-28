# Supabase 로그인 DB 설정

## 구조

Supabase 프로젝트에는 하나의 PostgreSQL 데이터베이스가 있습니다. 사용자 정보는
`profiles` 테이블 하나에 저장하고 `role` 값으로 관리자를 구분합니다.

- `profiles`: 전체 사용자 원본 데이터
- `admins`: `role = admin` 사용자 조회 뷰
- `workers`: `role = worker` 사용자 조회 뷰
- `auth.users`: Supabase가 관리하는 인증 정보와 암호화된 비밀번호

비밀번호는 `profiles`에 저장하지 않습니다.

## SQL 적용

Supabase Dashboard의 **SQL Editor**에서 아래 파일의 내용을 실행합니다.

`migrations/202607290001_create_auth_profiles.sql`

## 아이디 로그인 방식

화면에서는 아이디만 입력받고 앱 내부에서 다음처럼 이메일로 변환합니다.

```ts
const normalizeLoginId = (value: string) => value.trim().toLowerCase();
const internalEmail = (loginId: string) =>
  `${normalizeLoginId(loginId)}@login.local`;
```

```ts
await supabase.auth.signInWithPassword({
  email: internalEmail(loginId),
  password,
});
```

`login_id`는 영문 소문자 또는 숫자로 시작해야 하며 영문 소문자, 숫자, `.`, `_`,
`-`를 포함해 3~32자로 사용합니다.

## 첫 관리자 만들기

1. Supabase Dashboard의 **Authentication > Users**에서 사용자를 생성합니다.
2. 이메일은 `admin@login.local`처럼 입력합니다.
3. SQL Editor에서 생성한 사용자를 관리자로 승격합니다.

```sql
update public.profiles
set
  role = 'admin',
  must_change_password = false
where login_id = 'admin';
```

## 작업자 생성

운영 앱에서는 `service_role` 또는 secret key를 Expo 앱에 넣으면 안 됩니다.
작업자 생성은 이후 Supabase Edge Function에서 관리자 권한을 확인한 다음
Admin Auth API로 처리해야 합니다.

계정 생성 시 Auth 사용자 메타데이터에는 아래 값을 전달합니다.

```json
{
  "login_id": "worker01",
  "name": "김작업"
}
```

DB 트리거가 신규 사용자를 항상 `worker`로 생성합니다. 클라이언트가 메타데이터에
`role: "admin"`을 넣어도 관리자 권한이 부여되지 않습니다.

## 필수 설정

- 일반 사용자의 임의 가입을 막으려면 Supabase Auth 설정에서 회원가입을 비활성화합니다.
- 관리자/작업자 생성은 안전한 Edge Function을 통해서만 수행합니다.
- `service_role` 또는 secret key는 Expo 환경변수에도 절대 넣지 않습니다.
