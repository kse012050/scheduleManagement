import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { loginIdToEmail, normalizeLoginId, supabase } from '@/lib/supabase';
import { AppData, Job, Role, Schedule, User } from '@/types';

const DATA_KEY = '@work-schedule/local-data/v2';
const LOGIN_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;

const initialData: AppData = {
  jobs: [],
  schedules: [],
};

type ProfileRow = {
  id: string;
  login_id: string;
  name: string;
  role: Role;
  must_change_password: boolean;
  is_active: boolean;
  created_at: string;
};

type ContextValue = {
  ready: boolean;
  currentUser: User | null;
  users: User[];
  jobs: Job[];
  schedules: Schedule[];
  login: (loginId: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  changePassword: (password: string) => Promise<string | null>;
  addWorker: (input: {
    loginId: string;
    name: string;
  }) => Promise<{ temporaryPassword: string | null; error: string | null }>;
  deleteWorker: (workerId: string) => Promise<string | null>;
  resetWorkerPassword: (
    workerId: string,
  ) => Promise<{ temporaryPassword: string | null; error: string | null }>;
  addJob: (input: { title: string; description: string; location: string }) => Promise<void>;
  setJobWorkers: (jobId: string, workerIds: string[]) => Promise<void>;
  addSchedule: (input: Omit<Schedule, 'id' | 'createdAt' | 'createdBy'>) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
  canManageSchedule: (schedule: Schedule) => boolean;
};

const AppContext = createContext<ContextValue | null>(null);

const mapProfile = (profile: ProfileRow): User => ({
  id: profile.id,
  loginId: profile.login_id,
  name: profile.name,
  role: profile.role,
  mustChangePassword: profile.must_change_password,
  active: profile.is_active,
  createdAt: profile.created_at,
});

const functionErrorMessage = async (
  invokeError: unknown,
  fallback: string,
) => {
  const response = (invokeError as { context?: Response } | null)?.context;

  if (response) {
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) return body.error;
    } catch {
      // Use the safe fallback when the function response is not JSON.
    }
  }

  return fallback;
};

export function AppProvider({ children }: React.PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<AppData>(initialData);
  const [users, setUsers] = useState<User[]>([]);
  const [authUserId, setAuthUserId] = useState<string | null>(null);

  const refreshProfiles = async (signedInUserId: string) => {
    const { data: profileRows, error } = await supabase
      .from('profiles')
      .select('id, login_id, name, role, must_change_password, is_active, created_at')
      .order('created_at', { ascending: true });

    if (error) {
      setUsers([]);
      return error.message;
    }

    const nextUsers = (profileRows as ProfileRow[]).map(mapProfile);
    setUsers(nextUsers);

    if (!nextUsers.some((user) => user.id === signedInUserId && user.active)) {
      return '사용할 수 없는 계정입니다.';
    }

    return null;
  };

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      const [savedData, sessionResult] = await Promise.all([
        AsyncStorage.getItem(DATA_KEY),
        supabase.auth.getSession(),
      ]);

      if (!mounted) return;

      if (savedData) {
        try {
          setData(JSON.parse(savedData));
        } catch {
          setData(initialData);
        }
      }

      const session = sessionResult.data.session;
      if (session) {
        setAuthUserId(session.user.id);
        const profileError = await refreshProfiles(session.user.id);
        if (profileError) {
          await supabase.auth.signOut();
          setAuthUserId(null);
          setUsers([]);
        }
      }

      if (mounted) setReady(true);
    };

    void initialize().catch(() => {
      if (mounted) setReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_OUT' || !session) {
        setAuthUserId(null);
        setUsers([]);
        return;
      }

      setAuthUserId(session.user.id);
      setTimeout(() => {
        if (mounted) void refreshProfiles(session.user.id);
      }, 0);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const persist = async (next: AppData) => {
    setData(next);
    await AsyncStorage.setItem(DATA_KEY, JSON.stringify(next));
  };

  const currentUser =
    users.find((user) => user.id === authUserId && user.active) ?? null;

  const value = useMemo<ContextValue>(
    () => ({
      ready,
      currentUser,
      users,
      jobs: data.jobs,
      schedules: data.schedules,
      login: async (loginId, password) => {
        const normalizedLoginId = normalizeLoginId(loginId);

        if (!LOGIN_ID_PATTERN.test(normalizedLoginId)) {
          return '아이디는 영문 소문자 또는 숫자로 시작하는 3~32자로 입력해주세요.';
        }

        const { data: authData, error: authError } =
          await supabase.auth.signInWithPassword({
            email: loginIdToEmail(normalizedLoginId),
            password,
          });

        if (authError || !authData.user) {
          return '아이디 또는 비밀번호를 확인해주세요.';
        }

        const profileError = await refreshProfiles(authData.user.id);
        if (profileError) {
          await supabase.auth.signOut();
          setAuthUserId(null);
          setUsers([]);
          return profileError.includes('profiles')
            ? '계정 테이블이 준비되지 않았습니다. Supabase SQL을 먼저 실행해주세요.'
            : profileError;
        }

        setAuthUserId(authData.user.id);
        return null;
      },
      logout: async () => {
        try {
          await supabase.auth.signOut();
        } finally {
          setAuthUserId(null);
          setUsers([]);
        }
      },
      changePassword: async (password) => {
        if (!currentUser) return '로그인 정보가 없습니다.';

        const { error: passwordError } = await supabase.auth.updateUser({
          password,
        });
        if (passwordError) return '비밀번호를 변경하지 못했습니다.';

        const { error: profileError } = await supabase
          .from('profiles')
          .update({ must_change_password: false })
          .eq('id', currentUser.id);

        if (profileError) return '계정 상태를 업데이트하지 못했습니다.';

        setUsers((previous) =>
          previous.map((user) =>
            user.id === currentUser.id
              ? { ...user, mustChangePassword: false }
              : user,
          ),
        );
        return null;
      },
      addWorker: async ({ loginId, name }) => {
        if (!currentUser || currentUser.role !== 'admin') {
          return {
            temporaryPassword: null,
            error: '관리자만 작업자 계정을 생성할 수 있습니다.',
          };
        }

        const normalizedLoginId = normalizeLoginId(loginId);
        if (!LOGIN_ID_PATTERN.test(normalizedLoginId)) {
          return {
            temporaryPassword: null,
            error:
              '아이디는 영문 소문자 또는 숫자로 시작하는 3~32자로 입력해주세요.',
          };
        }

        if (!name.trim()) {
          return {
            temporaryPassword: null,
            error: '작업자 이름을 입력해주세요.',
          };
        }

        const { data: result, error: invokeError } =
          await supabase.functions.invoke('create-worker', {
            body: {
              loginId: normalizedLoginId,
              name: name.trim(),
            },
          });

        if (invokeError) {
          return {
            temporaryPassword: null,
            error: await functionErrorMessage(
              invokeError,
              '작업자 계정을 생성하지 못했습니다.',
            ),
          };
        }

        const temporaryPassword =
          typeof result?.temporaryPassword === 'string'
            ? result.temporaryPassword
            : null;

        if (!temporaryPassword) {
          return {
            temporaryPassword: null,
            error: result?.error ?? '임시 비밀번호를 받지 못했습니다.',
          };
        }

        await refreshProfiles(currentUser.id);
        return { temporaryPassword, error: null };
      },
      deleteWorker: async (workerId) => {
        if (!currentUser || currentUser.role !== 'admin') {
          return '관리자만 작업자를 삭제할 수 있습니다.';
        }
        if (workerId === currentUser.id) {
          return '현재 로그인한 관리자 계정은 삭제할 수 없습니다.';
        }

        const { error: invokeError } = await supabase.functions.invoke(
          'delete-worker',
          { body: { workerId } },
        );

        if (invokeError) {
          return functionErrorMessage(
            invokeError,
            '작업자 계정을 삭제하지 못했습니다.',
          );
        }

        const nextData: AppData = {
          ...data,
          jobs: data.jobs.map((job) => ({
            ...job,
            workerIds: job.workerIds.filter((id) => id !== workerId),
          })),
        };
        await persist(nextData);
        setUsers((previous) =>
          previous.filter((user) => user.id !== workerId),
        );
        return null;
      },
      resetWorkerPassword: async (workerId) => {
        if (!currentUser || currentUser.role !== 'admin') {
          return {
            temporaryPassword: null,
            error: '관리자만 비밀번호를 초기화할 수 있습니다.',
          };
        }

        const { data: result, error: invokeError } =
          await supabase.functions.invoke('reset-worker-password', {
            body: { workerId },
          });

        if (invokeError) {
          return {
            temporaryPassword: null,
            error: await functionErrorMessage(
              invokeError,
              '비밀번호를 초기화하지 못했습니다.',
            ),
          };
        }

        const temporaryPassword =
          typeof result?.temporaryPassword === 'string'
            ? result.temporaryPassword
            : null;

        if (!temporaryPassword) {
          return {
            temporaryPassword: null,
            error: result?.error ?? '임시 비밀번호를 받지 못했습니다.',
          };
        }

        setUsers((previous) =>
          previous.map((user) =>
            user.id === workerId
              ? { ...user, mustChangePassword: true }
              : user,
          ),
        );
        return { temporaryPassword, error: null };
      },
      addJob: async (input) => {
        if (!currentUser || currentUser.role !== 'admin') return;
        const job: Job = {
          id: `job-${Date.now()}`,
          ...input,
          workerIds: [],
          createdAt: new Date().toISOString(),
          createdBy: currentUser.id,
        };
        await persist({ ...data, jobs: [job, ...data.jobs] });
      },
      setJobWorkers: async (jobId, workerIds) => {
        if (!currentUser || currentUser.role !== 'admin') return;
        await persist({
          ...data,
          jobs: data.jobs.map((job) =>
            job.id === jobId ? { ...job, workerIds } : job,
          ),
        });
      },
      addSchedule: async (input) => {
        if (!currentUser) return;
        const schedule: Schedule = {
          id: `schedule-${Date.now()}`,
          ...input,
          createdBy: currentUser.id,
          createdAt: new Date().toISOString(),
        };
        await persist({
          ...data,
          schedules: [...data.schedules, schedule],
        });
      },
      deleteSchedule: async (id) => {
        const target = data.schedules.find((item) => item.id === id);
        if (
          !target ||
          !(currentUser?.role === 'admin' || target.createdBy === currentUser?.id)
        ) {
          return;
        }
        await persist({
          ...data,
          schedules: data.schedules.filter((item) => item.id !== id),
        });
      },
      canManageSchedule: (schedule) =>
        currentUser?.role === 'admin' ||
        schedule.createdBy === currentUser?.id,
    }),
    [ready, currentUser, users, data],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider');
  return value;
};
