# 작업 일정 관리 앱

Expo + React Native로 만든 관리자/작업자용 일정 관리 앱입니다.

## 실행

```bash
npm install
npm start
```

웹으로 실행하려면:

```bash
npm run web
```

## Supabase 설정

프로젝트 루트의 `.env`에 Supabase 연결 정보를 입력합니다.

```env
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_YOUR_KEY
```

DB 스키마와 관리자 계정 준비 방법은 `supabase/README.md`를 확인하세요.

로그인 화면에서는 이메일 대신 아이디를 입력합니다. 앱이 내부적으로
`아이디@login.local` 형식으로 변환해 Supabase Auth에 로그인합니다.

## 현재 저장 범위

- 로그인, 세션, 사용자 프로필, 역할, 비밀번호 변경: Supabase
- 작업, 배정, 일정: 기기의 AsyncStorage

작업과 일정 데이터는 다음 DB 연결 단계에서 Supabase로 이전할 예정입니다.
