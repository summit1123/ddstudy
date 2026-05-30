export type VoiceRequest = {
  text?: string;
  voiceId?: string;
  modelId?: string;
};

export class VoiceRouteError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export async function synthesizeWithElevenLabs(request: VoiceRequest, apiKey = process.env.ELEVENLABS_API_KEY) {
  if (!apiKey) {
    throw new VoiceRouteError("Missing ELEVENLABS_API_KEY. The voice route will not return fake audio.", 500, "missing_api_key");
  }

  const text = request.text?.trim();
  if (!text) {
    throw new VoiceRouteError("Missing text for speech synthesis.", 400, "missing_text");
  }

  const voiceId = request.voiceId ?? process.env.ELEVENLABS_VOICE_ID;
  if (!voiceId) {
    throw new VoiceRouteError("Missing voiceId. Provide voiceId in the request or ELEVENLABS_VOICE_ID in the environment.", 400, "missing_voice_id");
  }

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: request.modelId ?? process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.8,
      },
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new VoiceRouteError(`ElevenLabs API error: ${response.status}`, response.status, "elevenlabs_api_error", details);
  }

  return Buffer.from(await response.arrayBuffer());
}
