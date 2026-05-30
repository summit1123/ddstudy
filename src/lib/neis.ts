import { ENV_KEYS, EnvConfigError, getEnvValue } from "./env";

const NEIS_BASE_URL = "https://open.neis.go.kr/hub";

export type NeisSchool = {
  ATPT_OFCDC_SC_CODE: string;
  ATPT_OFCDC_SC_NM: string;
  SD_SCHUL_CODE: string;
  SCHUL_NM: string;
  ENG_SCHUL_NM?: string | null;
  SCHUL_KND_SC_NM: string;
  LCTN_SC_NM?: string | null;
  ORG_RDNMA?: string | null;
  ORG_RDNDA?: string | null;
  ORG_TELNO?: string | null;
  HMPG_ADRES?: string | null;
  LOAD_DTM?: string | null;
};

export type NeisTimetableKind = "els" | "mis" | "his" | "sps";

export type NeisTimetableRow = {
  ATPT_OFCDC_SC_CODE: string;
  ATPT_OFCDC_SC_NM: string;
  SD_SCHUL_CODE: string;
  SCHUL_NM: string;
  AY: string;
  SEM: string;
  ALL_TI_YMD: string;
  GRADE?: string;
  CLASS_NM?: string;
  PERIO?: string;
  ITRT_CNTNT?: string;
  LOAD_DTM?: string;
};

export type NeisScheduleRow = {
  ATPT_OFCDC_SC_CODE: string;
  ATPT_OFCDC_SC_NM: string;
  SD_SCHUL_CODE: string;
  SCHUL_NM: string;
  AY: string;
  AA_YMD: string;
  EVENT_NM: string;
  EVENT_CNTNT?: string | null;
  ONE_GRADE_EVENT_YN?: string;
  TW_GRADE_EVENT_YN?: string;
  THREE_GRADE_EVENT_YN?: string;
  FR_GRADE_EVENT_YN?: string;
  FIV_GRADE_EVENT_YN?: string;
  SIX_GRADE_EVENT_YN?: string;
  SBTR_DD_SC_NM?: string;
  LOAD_DTM?: string;
};

export type NeisListResult<T> = {
  source: "NEIS";
  endpoint: string;
  auth: {
    keyName: "NEIS_API_KEY";
    keyConfigured: boolean;
    keySent: boolean;
    retriedWithoutKey: boolean;
  };
  result: {
    code: string;
    message: string;
  };
  totalCount: number;
  rows: T[];
};

type NeisEndpoint =
  | "schoolInfo"
  | "SchoolSchedule"
  | "elsTimetable"
  | "misTimetable"
  | "hisTimetable"
  | "spsTimetable";

type NeisParams = Record<string, string | number | undefined>;

const TIMETABLE_ENDPOINTS: Record<NeisTimetableKind, NeisEndpoint> = {
  els: "elsTimetable",
  mis: "misTimetable",
  his: "hisTimetable",
  sps: "spsTimetable",
};

export async function searchSchools(params: {
  query: string;
  officeCode?: string;
  schoolKind?: string;
  location?: string;
  page?: number;
  pageSize?: number;
}): Promise<NeisListResult<NeisSchool>> {
  return fetchNeisRows<NeisSchool>("schoolInfo", {
    SCHUL_NM: requiredString(params.query, "query"),
    ATPT_OFCDC_SC_CODE: params.officeCode,
    SCHUL_KND_SC_NM: params.schoolKind,
    LCTN_SC_NM: params.location,
    pIndex: clampPage(params.page),
    pSize: clampPageSize(params.pageSize),
  });
}

export async function getTimetable(params: {
  kind: NeisTimetableKind;
  officeCode: string;
  schoolCode: string;
  date: string;
  grade?: string;
  className?: string;
  page?: number;
  pageSize?: number;
}): Promise<NeisListResult<NeisTimetableRow>> {
  const endpoint = TIMETABLE_ENDPOINTS[params.kind];

  if (!endpoint) {
    throw new NeisClientError(
      "INVALID_TIMETABLE_KIND",
      "kind must be one of els, mis, his, or sps.",
      400,
    );
  }

  return fetchNeisRows<NeisTimetableRow>(endpoint, {
    ATPT_OFCDC_SC_CODE: requiredString(params.officeCode, "officeCode"),
    SD_SCHUL_CODE: requiredString(params.schoolCode, "schoolCode"),
    ALL_TI_YMD: normalizeYmd(params.date, "date"),
    GRADE: params.grade,
    CLASS_NM: params.className,
    pIndex: clampPage(params.page),
    pSize: clampPageSize(params.pageSize),
  });
}

export async function getSchedule(params: {
  officeCode: string;
  schoolCode: string;
  date?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}): Promise<NeisListResult<NeisScheduleRow>> {
  const date = params.date ? normalizeYmd(params.date, "date") : undefined;
  const from = params.from ? normalizeYmd(params.from, "from") : undefined;
  const to = params.to ? normalizeYmd(params.to, "to") : undefined;

  if (!date && (!from || !to)) {
    throw new NeisClientError(
      "MISSING_DATE_RANGE",
      "Provide date or both from and to in YYYY-MM-DD or YYYYMMDD format.",
      400,
    );
  }

  return fetchNeisRows<NeisScheduleRow>("SchoolSchedule", {
    ATPT_OFCDC_SC_CODE: requiredString(params.officeCode, "officeCode"),
    SD_SCHUL_CODE: requiredString(params.schoolCode, "schoolCode"),
    AA_YMD: date,
    AA_FROM_YMD: from,
    AA_TO_YMD: to,
    pIndex: clampPage(params.page),
    pSize: clampPageSize(params.pageSize),
  });
}

export function schoolKindToTimetableKind(
  schoolKindName: string | undefined,
): NeisTimetableKind | undefined {
  if (!schoolKindName) return undefined;
  if (schoolKindName.includes("초등")) return "els";
  if (schoolKindName.includes("중학교")) return "mis";
  if (schoolKindName.includes("고등")) return "his";
  if (schoolKindName.includes("특수")) return "sps";
  return undefined;
}

async function fetchNeisRows<T>(
  endpoint: NeisEndpoint,
  params: NeisParams,
): Promise<NeisListResult<T>> {
  const apiKey = getEnvValue(ENV_KEYS.NEIS_API_KEY);

  if (!apiKey) {
    const result = await requestNeisRows<T>(endpoint, params, undefined);
    return withAuthMetadata(result, false, false, false);
  }

  try {
    const result = await requestNeisRows<T>(endpoint, params, apiKey);
    return withAuthMetadata(result, true, true, false);
  } catch (error) {
    if (!(error instanceof NeisUpstreamError)) {
      throw error;
    }

    const result = await requestNeisRows<T>(endpoint, params, undefined);
    return withAuthMetadata(result, true, false, true);
  }
}

async function requestNeisRows<T>(
  endpoint: NeisEndpoint,
  params: NeisParams,
  apiKey: string | undefined,
): Promise<Omit<NeisListResult<T>, "auth">> {
  const url = new URL(`${NEIS_BASE_URL}/${endpoint}`);

  if (apiKey) {
    url.searchParams.set("KEY", apiKey);
  }

  url.searchParams.set("Type", "json");

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: "*/*",
      },
      cache: "no-store",
    });
  } catch (error) {
    throw new NeisUpstreamError(
      "NETWORK_ERROR",
      error instanceof Error ? error.message : "Failed to reach NEIS.",
      502,
      endpoint,
    );
  }

  if (!response.ok) {
    throw new NeisUpstreamError(
      "HTTP_ERROR",
      `NEIS responded with HTTP ${response.status}.`,
      502,
      endpoint,
    );
  }

  const payload = await readJson(response, endpoint);
  const parsed = parseNeisPayload<T>(endpoint, payload);

  if (parsed.result.code !== "INFO-000" && parsed.result.code !== "INFO-200") {
    throw new NeisUpstreamError(
      parsed.result.code,
      parsed.result.message,
      502,
      endpoint,
    );
  }

  return parsed;
}

function withAuthMetadata<T>(
  result: Omit<NeisListResult<T>, "auth">,
  keyConfigured: boolean,
  keySent: boolean,
  retriedWithoutKey: boolean,
): NeisListResult<T> {
  return {
    ...result,
    auth: {
      keyName: "NEIS_API_KEY",
      keyConfigured,
      keySent,
      retriedWithoutKey,
    },
  };
}

async function readJson(response: Response, endpoint: NeisEndpoint) {
  try {
    return await response.json();
  } catch {
    throw new NeisUpstreamError(
      "INVALID_JSON",
      "NEIS returned a non-JSON response.",
      502,
      endpoint,
    );
  }
}

function parseNeisPayload<T>(
  endpoint: NeisEndpoint,
  payload: unknown,
): Omit<NeisListResult<T>, "auth"> {
  if (!payload || typeof payload !== "object") {
    throw new NeisUpstreamError(
      "INVALID_PAYLOAD",
      "NEIS returned an empty or invalid response.",
      502,
      endpoint,
    );
  }

  const root = (payload as Record<string, unknown>)[endpoint];
  const topLevelResult = (payload as { RESULT?: { CODE?: string; MESSAGE?: string } })
    .RESULT;

  if (!Array.isArray(root)) {
    return {
      source: "NEIS",
      endpoint,
      result: {
        code: topLevelResult?.CODE ?? "INFO-200",
        message: topLevelResult?.MESSAGE ?? "No rows returned by NEIS.",
      },
      totalCount: 0,
      rows: [],
    };
  }

  const head = root.find((section) => {
    return Boolean(
      section &&
        typeof section === "object" &&
        Array.isArray((section as { head?: unknown }).head),
    );
  }) as { head?: unknown[] } | undefined;

  const rows = root.find((section) => {
    return Boolean(
      section &&
        typeof section === "object" &&
        Array.isArray((section as { row?: unknown }).row),
    );
  }) as { row?: T[] } | undefined;

  const totalCount =
    head?.head?.find(
      (item): item is { list_total_count: number } =>
        Boolean(item && typeof item === "object" && "list_total_count" in item),
    )?.list_total_count ?? 0;

  const result =
    head?.head?.find(
      (item): item is { RESULT: { CODE?: string; MESSAGE?: string } } =>
        Boolean(item && typeof item === "object" && "RESULT" in item),
    )?.RESULT ?? topLevelResult;

  return {
    source: "NEIS",
    endpoint,
    result: {
      code: result?.CODE ?? "INFO-000",
      message: result?.MESSAGE ?? "정상 처리되었습니다.",
    },
    totalCount,
    rows: rows?.row ?? [],
  };
}

function normalizeYmd(value: string, fieldName: string): string {
  const normalized = value.replaceAll("-", "");

  if (!/^\d{8}$/.test(normalized)) {
    throw new NeisClientError(
      "INVALID_DATE",
      `${fieldName} must be in YYYY-MM-DD or YYYYMMDD format.`,
      400,
    );
  }

  return normalized;
}

function requiredString(value: string | undefined, fieldName: string): string {
  if (!value?.trim()) {
    throw new NeisClientError(
      "MISSING_PARAMETER",
      `${fieldName} is required.`,
      400,
    );
  }

  return value.trim();
}

function clampPage(value: number | undefined): number {
  if (!Number.isFinite(value) || !value || value < 1) return 1;
  return Math.floor(value);
}

function clampPageSize(value: number | undefined): number {
  if (!Number.isFinite(value) || !value) return 20;
  return Math.min(Math.max(Math.floor(value), 1), 100);
}

export function parsePositiveInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function serializeApiError(error: unknown) {
  if (
    error instanceof NeisClientError ||
    error instanceof NeisUpstreamError ||
    error instanceof EnvConfigError
  ) {
    return {
      status: error.status,
      body: {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          ...(error instanceof NeisUpstreamError
            ? { endpoint: error.endpoint }
            : {}),
          ...(error instanceof EnvConfigError
            ? { keyName: error.keyName }
            : {}),
        },
      },
    };
  }

  return {
    status: 500,
    body: {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Unexpected error.",
      },
    },
  };
}

export class NeisClientError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "NeisClientError";
    this.code = code;
    this.status = status;
  }
}

export class NeisUpstreamError extends Error {
  readonly code: string;
  readonly status: number;
  readonly endpoint: string;

  constructor(code: string, message: string, status: number, endpoint: string) {
    super(message);
    this.name = "NeisUpstreamError";
    this.code = code;
    this.status = status;
    this.endpoint = endpoint;
  }
}
