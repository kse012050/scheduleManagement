# 작업 일정 관리 앱

Expo + React Native로 만든 관리자/작업자용 일정 관리 MVP입니다.

## 실행

```bash
npm install
npm start
```

- 관리자: `admin` / `admin123`
- 작업자: `worker01` / `0000` (첫 로그인 시 비밀번호 변경)

현재 데이터와 로그인 세션은 기기의 AsyncStorage에 저장됩니다. 실제 운영 전에는 API 서버, 비밀번호 해시, 토큰 인증과 서버 측 권한 검증을 추가해야 합니다.
