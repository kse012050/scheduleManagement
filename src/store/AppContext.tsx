import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { loginIdToEmail, normalizeLoginId, supabase } from '@/lib/supabase';
import { Job, Role, Schedule, User, WorkType } from '@/types';

const LOGIN_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;
const PHONE_PATTERN = /^01[016789][0-9]{7,8}$/;

type ProfileRow = {
  id: string;
  login_id: string;
  name: string;
  role: Role;
  must_change_password: boolean;
  is_active: boolean;
  phone: string | null;
  work_type_id: number | null;
  created_at: string;
};

type WorkTypeRow = {
  id: number;
  name: string;
  note: string | null;
  color_hex: string;
  sort_order: number;
  is_active: boolean;
};

type JobRow = {
  id: string;
  title: string;
  description: string;
  location: string;
  created_by: string;
  created_at: string;
};

type AssignmentRow = {
  job_id: string;
  worker_id: string;
};

type ScheduleRow = {
  id: string;
  job_id: string;
  title: string;
  start_date: string;
  end_date: string;
  note: string;
  created_by: string;
  created_at: string;
};

type ContextValue = {
  ready: boolean;
  currentUser: User | null;
  users: User[];
  workTypes: WorkType[];
  jobs: Job[];
  schedules: Schedule[];
  login: (loginId: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  changePassword: (password: string) => Promise<string | null>;
  updateAdminPhone: (phone: string) => Promise<string | null>;
  addWorker: (input: {
    loginId: string;
    name: string;
    phone: string;
    workTypeId: number;
  }) => Promise<{ temporaryPassword: string | null; error: string | null }>;
  updateWorker: (
    workerId: string,
    input: { name: string; phone: string; workTypeId: number },
  ) => Promise<string | null>;
  deleteWorker: (workerId: string) => Promise<string | null>;
  resetWorkerPassword: (
    workerId: string,
  ) => Promise<{ temporaryPassword: string | null; error: string | null }>;
  addJob: (input: { title: string; description: string; location: string }) => Promise<string | null>;
  updateJob: (
    jobId: string,
    input: { title: string; description: string; location: string },
  ) => Promise<string | null>;
  setJobWorkers: (jobId: string, workerIds: string[]) => Promise<string | null>;
  addSchedule: (input: Omit<Schedule, 'id' | 'createdAt' | 'createdBy'>) => Promise<string | null>;
  updateSchedule: (
    scheduleId: string,
    input: Omit<Schedule, 'id' | 'createdAt' | 'createdBy'>,
  ) => Promise<string | null>;
  deleteSchedule: (id: string) => Promise<string | null>;
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
  phone: profile.phone,
  workTypeId: profile.work_type_id,
  createdAt: profile.created_at,
});

const mapWorkType = (workType: WorkTypeRow): WorkType => ({
  id: workType.id,
  name: workType.name,
  note: workType.note,
  colorHex: workType.color_hex,
  sortOrder: workType.sort_order,
  active: workType.is_active,
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
  const [users, setUsers] = useState<User[]>([]);
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [authUserId, setAuthUserId] = useState<string | null>(null);

  const refreshProfiles = async (signedInUserId: string) => {
    const [profilesResult, workTypesResult] = await Promise.all([
      supabase
        .from('profiles')
        .select(
          'id, login_id, name, role, must_change_password, is_active, phone, work_type_id, created_at',
        )
        .order('created_at', { ascending: true }),
      supabase
        .from('work_types')
        .select('id, name, note, color_hex, sort_order, is_active')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
    ]);

    const error = profilesResult.error ?? workTypesResult.error;
    if (error) {
      setUsers([]);
      setWorkTypes([]);
      return error.message;
    }

    const nextUsers = (profilesResult.data as ProfileRow[]).map(mapProfile);
    setUsers(nextUsers);
    setWorkTypes((workTypesResult.data as WorkTypeRow[]).map(mapWorkType));

    if (!nextUsers.some((user) => user.id === signedInUserId && user.active)) {
      return '사용할 수 없는 계정입니다.';
    }

    return null;
  };

  const refreshWorkData = async () => {
    const [jobsResult, assignmentsResult, schedulesResult] = await Promise.all([
      supabase
        .from('jobs')
        .select('id, title, description, location, created_by, created_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('job_assignments')
        .select('job_id, worker_id'),
      supabase
        .from('schedules')
        .select('id, job_id, title, start_date, end_date, note, created_by, created_at')
        .order('start_date', { ascending: true }),
    ]);

    const firstError =
      jobsResult.error ?? assignmentsResult.error ?? schedulesResult.error;
    if (firstError) {
      setJobs([]);
      setSchedules([]);
      return firstError.message;
    }

    const assignmentRows = assignmentsResult.data as AssignmentRow[];
    setJobs(
      (jobsResult.data as JobRow[]).map((job) => ({
        id: job.id,
        title: job.title,
        description: job.description,
        location: job.location,
        workerIds: assignmentRows
          .filter((assignment) => assignment.job_id === job.id)
          .map((assignment) => assignment.worker_id),
        createdAt: job.created_at,
        createdBy: job.created_by,
      })),
    );
    setSchedules(
      (schedulesResult.data as ScheduleRow[]).map((schedule) => ({
        id: schedule.id,
        jobId: schedule.job_id,
        title: schedule.title,
        startDate: schedule.start_date,
        endDate: schedule.end_date,
        note: schedule.note,
        createdBy: schedule.created_by,
        createdAt: schedule.created_at,
      })),
    );
    return null;
  };

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      const sessionResult = await supabase.auth.getSession();

      if (!mounted) return;

      const session = sessionResult.data.session;
      if (session) {
        setAuthUserId(session.user.id);
        const profileError = await refreshProfiles(session.user.id);
        if (profileError) {
          await supabase.auth.signOut();
          setAuthUserId(null);
          setUsers([]);
          setWorkTypes([]);
        } else {
          await refreshWorkData();
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
        setWorkTypes([]);
        setJobs([]);
        setSchedules([]);
        return;
      }

      setAuthUserId(session.user.id);

      // updateUser() emits USER_UPDATED before the profile flag is updated.
      // Refreshing here can restore the stale must_change_password value and
      // redirect the user back to the password-change screen.
      if (event === 'USER_UPDATED') return;

      setTimeout(() => {
        if (mounted) {
          void Promise.all([
            refreshProfiles(session.user.id),
            refreshWorkData(),
          ]);
        }
      }, 0);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const currentUser =
    users.find((user) => user.id === authUserId && user.active) ?? null;

  const value = useMemo<ContextValue>(
    () => ({
      ready,
      currentUser,
      users,
      workTypes,
      jobs,
      schedules,
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
          setWorkTypes([]);
          return profileError.includes('profiles')
            ? '계정 테이블이 준비되지 않았습니다. Supabase SQL을 먼저 실행해주세요.'
            : profileError;
        }

        setAuthUserId(authData.user.id);
        await refreshWorkData();
        return null;
      },
      logout: async () => {
        try {
          await supabase.auth.signOut();
        } finally {
          setAuthUserId(null);
          setUsers([]);
          setWorkTypes([]);
          setJobs([]);
          setSchedules([]);
        }
      },
      changePassword: async (password) => {
        if (!currentUser) return '로그인 정보가 없습니다.';

        const { error: passwordError } = await supabase.auth.updateUser({
          password,
        });
        if (passwordError) {
          return `비밀번호를 변경하지 못했습니다. (${passwordError.message})`;
        }

        const { error: profileError } = await supabase
          .from('profiles')
          .update({ must_change_password: false })
          .eq('id', currentUser.id);

        if (profileError) return '계정 상태를 업데이트하지 못했습니다.';

        const refreshError = await refreshProfiles(currentUser.id);
        if (refreshError) return '변경된 계정 상태를 불러오지 못했습니다.';

        return null;
      },
      updateAdminPhone: async (phone) => {
        if (!currentUser || currentUser.role !== 'admin') {
          return '관리자만 전화번호를 변경할 수 있습니다.';
        }

        const normalizedPhone = phone.replace(/[^0-9]/g, '');
        if (!PHONE_PATTERN.test(normalizedPhone)) {
          return '전화번호를 올바르게 입력해주세요.';
        }

        const { error: invokeError } = await supabase.functions.invoke(
          'update-admin-phone',
          { body: { phone: normalizedPhone } },
        );
        if (invokeError) {
          return functionErrorMessage(
            invokeError,
            '전화번호를 변경하지 못했습니다.',
          );
        }

        await refreshProfiles(currentUser.id);
        return null;
      },
      addWorker: async ({ loginId, name, phone, workTypeId }) => {
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

        const normalizedPhone = phone.replace(/[^0-9]/g, '');
        if (!PHONE_PATTERN.test(normalizedPhone)) {
          return {
            temporaryPassword: null,
            error: '전화번호를 올바르게 입력해주세요.',
          };
        }

        if (!workTypes.some((workType) => workType.id === workTypeId)) {
          return {
            temporaryPassword: null,
            error: '작업 종류를 선택해주세요.',
          };
        }

        const { data: result, error: invokeError } =
          await supabase.functions.invoke('create-worker', {
            body: {
              loginId: normalizedLoginId,
              name: name.trim(),
              phone: normalizedPhone,
              workTypeId,
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
      updateWorker: async (workerId, { name, phone, workTypeId }) => {
        if (!currentUser || currentUser.role !== 'admin') {
          return '관리자만 작업자 정보를 변경할 수 있습니다.';
        }

        const normalizedName = name.trim();
        if (!normalizedName || normalizedName.length > 50) {
          return '이름은 1~50자로 입력해주세요.';
        }

        const normalizedPhone = phone.replace(/[^0-9]/g, '');
        if (!PHONE_PATTERN.test(normalizedPhone)) {
          return '전화번호를 올바르게 입력해주세요.';
        }

        if (!workTypes.some((workType) => workType.id === workTypeId)) {
          return '작업 종류를 선택해주세요.';
        }

        const { error: invokeError } = await supabase.functions.invoke(
          'update-worker',
          {
            body: {
              workerId,
              name: normalizedName,
              phone: normalizedPhone,
              workTypeId,
            },
          },
        );

        if (invokeError) {
          return functionErrorMessage(
            invokeError,
            '작업자 정보를 변경하지 못했습니다.',
          );
        }

        await refreshProfiles(currentUser.id);
        return null;
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

        setUsers((previous) =>
          previous.filter((user) => user.id !== workerId),
        );
        await refreshWorkData();
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
        if (!currentUser) return '로그인이 필요합니다.';

        const { error } = await supabase.from('jobs').insert({
          title: input.title.trim(),
          description: input.description.trim(),
          location: input.location.trim(),
          created_by: currentUser.id,
        });
        if (error) return '작업을 등록하지 못했습니다.';

        await refreshWorkData();
        return null;
      },
      updateJob: async (jobId, input) => {
        const target = jobs.find((job) => job.id === jobId);
        if (
          !currentUser ||
          !target ||
          !(
            currentUser.role === 'admin' ||
            target.createdBy === currentUser.id
          )
        ) {
          return '이 작업을 수정할 권한이 없습니다.';
        }

        const { error } = await supabase
          .from('jobs')
          .update({
            title: input.title.trim(),
            description: input.description.trim(),
            location: input.location.trim(),
          })
          .eq('id', jobId);
        if (error) return '작업을 수정하지 못했습니다.';

        await refreshWorkData();
        return null;
      },
      setJobWorkers: async (jobId, workerIds) => {
        if (!currentUser || currentUser.role !== 'admin') {
          return '관리자만 작업자를 배정할 수 있습니다.';
        }

        const { error: deleteError } = await supabase
          .from('job_assignments')
          .delete()
          .eq('job_id', jobId);
        if (deleteError) return '기존 작업자 배정을 변경하지 못했습니다.';

        if (workerIds.length) {
          const { error: insertError } = await supabase
            .from('job_assignments')
            .insert(
              workerIds.map((workerId) => ({
                job_id: jobId,
                worker_id: workerId,
                assigned_by: currentUser.id,
              })),
            );
          if (insertError) {
            await refreshWorkData();
            return '작업자를 배정하지 못했습니다.';
          }
        }

        await refreshWorkData();
        return null;
      },
      addSchedule: async (input) => {
        if (!currentUser) return '로그인이 필요합니다.';

        const { error } = await supabase.from('schedules').insert({
          job_id: input.jobId,
          title: input.title.trim(),
          start_date: input.startDate,
          end_date: input.endDate,
          note: input.note.trim(),
          created_by: currentUser.id,
        });
        if (error) return '일정을 등록하지 못했습니다.';

        await refreshWorkData();
        return null;
      },
      updateSchedule: async (scheduleId, input) => {
        const target = schedules.find(
          (schedule) => schedule.id === scheduleId,
        );
        if (
          !currentUser ||
          !target ||
          !(
            currentUser.role === 'admin' ||
            target.createdBy === currentUser.id
          )
        ) {
          return '이 일정을 수정할 권한이 없습니다.';
        }

        const { error } = await supabase
          .from('schedules')
          .update({
            title: input.title.trim(),
            start_date: input.startDate,
            end_date: input.endDate,
            note: input.note.trim(),
          })
          .eq('id', scheduleId);
        if (error) return '일정을 수정하지 못했습니다.';

        await refreshWorkData();
        return null;
      },
      deleteSchedule: async (id) => {
        const target = schedules.find((item) => item.id === id);
        if (
          !target ||
          !(currentUser?.role === 'admin' || target.createdBy === currentUser?.id)
        ) {
          return '이 일정을 삭제할 권한이 없습니다.';
        }

        const { error } = await supabase
          .from('schedules')
          .delete()
          .eq('id', id);
        if (error) return '일정을 삭제하지 못했습니다.';

        setSchedules((previous) =>
          previous.filter((schedule) => schedule.id !== id),
        );
        return null;
      },
      canManageSchedule: (schedule) =>
        currentUser?.role === 'admin' ||
        schedule.createdBy === currentUser?.id,
    }),
    [ready, currentUser, users, workTypes, jobs, schedules],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider');
  return value;
};
