export const SUPPORT_OPTION_LABELS = {
  easy_language: "쉬운 말 필요",
  step_breakdown: "단계 쪼개기",
  visual_hint: "시각 단서",
  repeat_check: "반복 확인",
  help_sentence: "도움 요청 문장",
  life_example: "생활 예시",
} as const;

export type SupportOptionKey = keyof typeof SUPPORT_OPTION_LABELS;

const SUPPORT_OPTION_ALIASES: Record<string, SupportOptionKey> = {
  easy_language: "easy_language",
  "쉬운 말 필요": "easy_language",
  "쉬운말 필요": "easy_language",
  step_breakdown: "step_breakdown",
  "단계 쪼개기": "step_breakdown",
  "단계 분해": "step_breakdown",
  visual_hint: "visual_hint",
  "시각 단서": "visual_hint",
  repeat_check: "repeat_check",
  "반복 확인": "repeat_check",
  help_sentence: "help_sentence",
  "도움 요청 문장": "help_sentence",
  life_example: "life_example",
  "생활 예시": "life_example",
};

export const SUPPORT_OPTION_KEYS = Object.keys(SUPPORT_OPTION_LABELS) as SupportOptionKey[];

export function normalizeSupportOptions(options?: string[] | null): SupportOptionKey[] {
  const normalized = new Set<SupportOptionKey>();
  for (const option of options ?? []) {
    const key = SUPPORT_OPTION_ALIASES[option.trim()];
    if (key) normalized.add(key);
  }
  return [...normalized];
}

export function supportOptionLabel(option: string) {
  const [normalized] = normalizeSupportOptions([option]);
  return normalized ? SUPPORT_OPTION_LABELS[normalized] : option;
}

export function supportOptionLabels(options?: string[] | null) {
  return normalizeSupportOptions(options).map((option) => SUPPORT_OPTION_LABELS[option]);
}

export function hasSupportOption(options: string[] | undefined | null, option: SupportOptionKey) {
  return normalizeSupportOptions(options).includes(option);
}
