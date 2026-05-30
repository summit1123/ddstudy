export const ENV_KEYS = {
  OPENAI_API_KEY: "OPENAI_API_KEY",
  NEIS_API_KEY: "NEIS_API_KEY",
  PUBLIC_DATA_API_KEY: "PUBLIC_DATA_API_KEY",
  ELEVENLABS_API_KEY: "ELEVENLABS_API_KEY",
  ELEVENLABS_VOICE_ID: "ELEVENLABS_VOICE_ID",
  DATABASE_URL: "DATABASE_URL",
  RAG_VECTOR_BACKEND: "RAG_VECTOR_BACKEND",
} as const;

export type EnvKeyName = (typeof ENV_KEYS)[keyof typeof ENV_KEYS];

export function getEnvValue(name: EnvKeyName): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function hasEnvValue(name: EnvKeyName): boolean {
  return Boolean(getEnvValue(name));
}

export function getRequiredEnvValue(name: EnvKeyName): string {
  const value = getEnvValue(name);

  if (!value) {
    throw new EnvConfigError(name);
  }

  return value;
}

export function getPublicEnvStatus() {
  return Object.values(ENV_KEYS).map((name) => ({
    name,
    configured: hasEnvValue(name),
  }));
}

export class EnvConfigError extends Error {
  readonly code = "MISSING_ENV";
  readonly status = 500;
  readonly keyName: EnvKeyName;

  constructor(keyName: EnvKeyName) {
    super(`${keyName} is required for this public API adapter.`);
    this.name = "EnvConfigError";
    this.keyName = keyName;
  }
}
