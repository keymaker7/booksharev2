export const LIMITS = {
  name: 20,
  title: 100,
  recommendation: 500,
  reason: 500,
  batchItems: 20,
} as const;

export function trimField(value: string, max: number, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label}을(를) 입력해 주세요`);
  if (trimmed.length > max) throw new Error(`${label}은(는) ${max}자 이하여야 해요`);
  return trimmed;
}
