import { NextResponse } from "next/server";
import { synthesizeWithElevenLabs, VoiceRouteError, type VoiceRequest } from "../../../lib/voice";

export async function POST(request: Request) {
  let body: VoiceRequest;

  try {
    body = (await request.json()) as VoiceRequest;
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "invalid_json",
          message: "Request body must be valid JSON.",
        },
      },
      { status: 400 },
    );
  }

  try {
    const audio = await synthesizeWithElevenLabs(body);
    return new Response(new Uint8Array(audio), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof VoiceRouteError) {
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        error: {
          code: "voice_synthesis_failed",
          message: error instanceof Error ? error.message : "Voice synthesis failed.",
        },
      },
      { status: 500 },
    );
  }
}
