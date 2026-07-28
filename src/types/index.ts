export type Role = 'admin' | 'worker';

export type User = {
  id: string;
  loginId: string;
  name: string;
  role: Role;
  mustChangePassword: boolean;
  active: boolean;
  createdAt: string;
};

export type Job = {
  id: string;
  title: string;
  description: string;
  location: string;
  workerIds: string[];
  createdAt: string;
  createdBy: string;
};

export type Schedule = {
  id: string;
  jobId: string;
  title: string;
  startDate: string;
  endDate: string;
  note: string;
  createdBy: string;
  createdAt: string;
};

export type AppData = { jobs: Job[]; schedules: Schedule[] };
