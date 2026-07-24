import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AppData, Job, Schedule, User } from '@/types';

const DATA_KEY = '@work-schedule/data/v1';
const SESSION_KEY = '@work-schedule/session/v1';

const seedData: AppData = {
  users: [
    { id: 'admin-1', loginId: 'admin', name: '관리자', password: 'admin123', role: 'admin', mustChangePassword: false, active: true, createdAt: new Date().toISOString() },
    { id: 'worker-1', loginId: 'worker01', name: '김작업', password: '0000', role: 'worker', mustChangePassword: true, active: true, createdAt: new Date().toISOString() },
  ],
  jobs: [
    { id: 'job-1', title: '강남 현장 인테리어', description: '내부 마감 및 설비 작업', location: '서울 강남구', workerIds: ['worker-1'], createdAt: new Date().toISOString(), createdBy: 'admin-1' },
  ],
  schedules: [],
};

type ContextValue = {
  ready: boolean;
  currentUser: User | null;
  users: User[];
  jobs: Job[];
  schedules: Schedule[];
  login: (loginId: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  changePassword: (password: string) => Promise<void>;
  addWorker: (input: { loginId: string; name: string; password: string }) => Promise<string | null>;
  addJob: (input: { title: string; description: string; location: string }) => Promise<void>;
  setJobWorkers: (jobId: string, workerIds: string[]) => Promise<void>;
  addSchedule: (input: Omit<Schedule, 'id' | 'createdAt' | 'createdBy'>) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
  canManageSchedule: (schedule: Schedule) => boolean;
};

const AppContext = createContext<ContextValue | null>(null);

export function AppProvider({ children }: React.PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<AppData>(seedData);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [savedData, savedSession] = await Promise.all([AsyncStorage.getItem(DATA_KEY), AsyncStorage.getItem(SESSION_KEY)]);
      if (savedData) setData(JSON.parse(savedData));
      if (savedSession) setSessionId(savedSession);
      setReady(true);
    })().catch(() => setReady(true));
  }, []);

  const persist = async (next: AppData) => { setData(next); await AsyncStorage.setItem(DATA_KEY, JSON.stringify(next)); };
  const currentUser = data.users.find((user) => user.id === sessionId && user.active) ?? null;

  const value = useMemo<ContextValue>(() => ({
    ready,
    currentUser,
    users: data.users,
    jobs: data.jobs,
    schedules: data.schedules,
    login: async (loginId, password) => {
      const user = data.users.find((item) => item.loginId.trim().toLowerCase() === loginId.trim().toLowerCase() && item.active);
      if (!user || user.password !== password) return '아이디 또는 비밀번호를 확인해주세요.';
      setSessionId(user.id);
      await AsyncStorage.setItem(SESSION_KEY, user.id);
      return null;
    },
    logout: async () => { setSessionId(null); await AsyncStorage.removeItem(SESSION_KEY); },
    changePassword: async (password) => {
      if (!currentUser) return;
      await persist({ ...data, users: data.users.map((user) => user.id === currentUser.id ? { ...user, password, mustChangePassword: false } : user) });
    },
    addWorker: async ({ loginId, name, password }) => {
      if (data.users.some((user) => user.loginId.toLowerCase() === loginId.trim().toLowerCase())) return '이미 사용 중인 아이디입니다.';
      const worker: User = { id: `user-${Date.now()}`, loginId: loginId.trim(), name: name.trim(), password, role: 'worker', mustChangePassword: true, active: true, createdAt: new Date().toISOString() };
      await persist({ ...data, users: [...data.users, worker] });
      return null;
    },
    addJob: async (input) => {
      if (!currentUser) return;
      const job: Job = { id: `job-${Date.now()}`, ...input, workerIds: [], createdAt: new Date().toISOString(), createdBy: currentUser.id };
      await persist({ ...data, jobs: [job, ...data.jobs] });
    },
    setJobWorkers: async (jobId, workerIds) => persist({ ...data, jobs: data.jobs.map((job) => job.id === jobId ? { ...job, workerIds } : job) }),
    addSchedule: async (input) => {
      if (!currentUser) return;
      const schedule: Schedule = { id: `schedule-${Date.now()}`, ...input, createdBy: currentUser.id, createdAt: new Date().toISOString() };
      await persist({ ...data, schedules: [...data.schedules, schedule] });
    },
    deleteSchedule: async (id) => {
      const target = data.schedules.find((item) => item.id === id);
      if (!target || !(currentUser?.role === 'admin' || target.createdBy === currentUser?.id)) return;
      await persist({ ...data, schedules: data.schedules.filter((item) => item.id !== id) });
    },
    canManageSchedule: (schedule) => currentUser?.role === 'admin' || schedule.createdBy === currentUser?.id,
  }), [ready, currentUser, data]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider');
  return value;
};
