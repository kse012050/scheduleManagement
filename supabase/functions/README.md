# Edge Function 배포

관리자용 Edge Function은 로그인한 관리자의 권한을 서버에서 다시 확인한 후
작업자 계정을 관리합니다.

- `create-worker`: 작업자 계정과 임시 비밀번호 생성
- `delete-worker`: 작업자 Auth 계정 삭제 (`profiles`는 cascade 삭제)
- `reset-worker-password`: 임시 비밀번호 재발급 및 최초 변경 상태 설정

## 최초 1회 로그인 및 프로젝트 연결

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
```

`YOUR_PROJECT_REF`는 Project URL의 앞부분입니다.

```text
https://YOUR_PROJECT_REF.supabase.co
```

## 함수 배포

```bash
npx supabase functions deploy create-worker --no-verify-jwt
npx supabase functions deploy delete-worker --no-verify-jwt
npx supabase functions deploy reset-worker-password --no-verify-jwt
```

함수의 게이트웨이 JWT 검사는 비활성화하지만 함수 코드에서 다음 검사를 직접
수행합니다.

1. 요청의 사용자 Access Token 검증
2. `profiles.role = admin` 확인
3. `profiles.is_active = true` 확인
4. 대상 계정이 작업자인지 확인
5. 생성 시 로그인 아이디 중복 검사

Supabase가 Edge Function에 기본 제공하는 `SUPABASE_SERVICE_ROLE_KEY`만 서버에서
사용하며 Expo 앱에는 Secret key가 포함되지 않습니다.

## 생성 결과

생성 및 비밀번호 초기화 함수는 성공 시 임시 비밀번호를 응답으로 한 번만
반환합니다.

```json
{
  "worker": {
    "id": "uuid",
    "loginId": "worker01",
    "name": "김작업"
  },
  "temporaryPassword": "무작위 12자리"
}
```

비밀번호는 DB나 로그에 별도로 저장하지 않습니다. 작업자가 최초 로그인해 새
비밀번호를 설정하면 `profiles.must_change_password`가 `false`로 변경됩니다.
