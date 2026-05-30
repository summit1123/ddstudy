import { NextResponse } from "next/server";
import { generateAssetsWithOpenAI, readAssetManifest, REQUIRED_IMAGE_MODEL } from "../../../lib/assets";

export async function GET() {
  try {
    return NextResponse.json(await readAssetManifest());
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "manifest_unavailable",
          message: error instanceof Error ? error.message : "Could not read asset manifest.",
        },
      },
      { status: 500 },
    );
  }
}

export async function POST() {
  try {
    const manifest = await generateAssetsWithOpenAI();
    return NextResponse.json(manifest);
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "asset_generation_failed",
          model: REQUIRED_IMAGE_MODEL,
          message: error instanceof Error ? error.message : "Asset generation failed.",
        },
      },
      { status: 500 },
    );
  }
}
