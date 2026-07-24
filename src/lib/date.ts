export const today = () => new Date().toISOString().slice(0, 10);

export const formatDate = (value: string) => {
  const [y, m, d] = value.split('-');
  return `${y}.${m}.${d}`;
};

export const monthTitle = (date: Date) => `${date.getFullYear()}년 ${date.getMonth() + 1}월`;

export const dateKey = (year: number, month: number, day: number) =>
  `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export const isDateInRange = (date: string, start: string, end: string) => date >= start && date <= end;

export const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
