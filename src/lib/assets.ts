import { promises as fs } from "node:fs";
import path from "node:path";

export const REQUIRED_IMAGE_MODEL = "gpt-image-2";

export type AssetManifestItem = {
  id: string;
  kind: "image" | "css";
  role: string;
  src: string;
  placeholder: boolean;
  label: string;
};

export type AssetManifest = {
  schemaVersion: 1;
  project: string;
  status: "placeholder" | "generated";
  model: string | null;
  generatedAt: string | null;
  notes: string[];
  assets: AssetManifestItem[];
};

type GeneratedAssetSpec = {
  id: string;
  fileName: string;
  role: string;
  prompt: string;
};

export const GENERATED_ASSET_SPECS: GeneratedAssetSpec[] = [
  {
    id: "logo-mark",
    fileName: "logo-mark.png",
    role: "다음한걸음 footprint logo mark",
    prompt:
      "Clean product logo mark for a Korean edtech service named 다음한걸음. A friendly blue footprint mascot mark, rounded app-icon feel, soft blue and mint palette, simple memorable shape, no readable text, centered on a plain solid white background. Do not draw transparency checkerboard. Do not draw a mockup background.",
  },
  {
    id: "student-mascot",
    fileName: "student-mascot.png",
    role: "student encouragement mascot",
    prompt:
      "Cute encouragement mascot for a Korean slow-learner support app. Rounded mint-and-blue character holding a small study card, warm and calm expression, premium mobile app illustration, no readable text, isolated on a plain solid white background. Do not draw transparency checkerboard. Do not draw a mockup background.",
  },
  {
    id: "help-robot",
    fileName: "help-robot.png",
    role: "empty/help state robot",
    prompt:
      "Small friendly AI help robot for a Korean teacher dashboard. Soft white robot with mint antenna and blue face screen, gentle supportive expression, premium SaaS empty-state illustration, no readable text, isolated on a plain solid white background. Do not draw transparency checkerboard. Do not draw a mockup background.",
  },
  {
    id: "math-card-icon",
    fileName: "math-card-icon.png",
    role: "generic math execution-card icon",
    prompt:
      "Generic math execution card icon for an edtech app. Rounded square purple-blue icon with plus, minus, multiply, divide symbols, polished app icon style, no readable words, centered on a plain solid white background. Do not draw transparency checkerboard. Do not draw a mockup background.",
  },
];

export const generatedAssetsDir = path.join(process.cwd(), "public", "assets", "generated");
export const assetManifestPath = path.join(generatedAssetsDir, "asset-manifest.json");
const legacyManifestPath = path.join(generatedAssetsDir, "manifest.json");

export async function readAssetManifest(): Promise<AssetManifest> {
  let manifest: string;
  try {
    manifest = await fs.readFile(assetManifestPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    manifest = await fs.readFile(legacyManifestPath, "utf8");
  }
  return JSON.parse(manifest) as AssetManifest;
}

export async function writeGeneratedAssetManifest(assetIds: string[]): Promise<AssetManifest> {
  const manifest: AssetManifest = {
    schemaVersion: 1,
    project: "다음한걸음 demo",
    status: "generated",
    model: REQUIRED_IMAGE_MODEL,
    generatedAt: new Date().toISOString(),
    notes: ["Generated through the asset API/script using gpt-image-2. No fallback model was used."],
    assets: GENERATED_ASSET_SPECS.filter((asset) => assetIds.includes(asset.id)).map((asset) => ({
      id: asset.id,
      kind: "image",
      role: asset.role,
      src: `/assets/generated/${asset.fileName}`,
      placeholder: false,
      label: "API generated",
    })),
  };

  await fs.mkdir(generatedAssetsDir, { recursive: true });
  await fs.writeFile(assetManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await fs.writeFile(legacyManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}

export async function generateAssetsWithOpenAI(apiKey = process.env.OPENAI_API_KEY): Promise<AssetManifest> {
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY. Asset generation requires gpt-image-2 and cannot use placeholders as generated output.");
  }

  await fs.mkdir(generatedAssetsDir, { recursive: true });
  const generatedIds: string[] = [];

  for (const asset of GENERATED_ASSET_SPECS) {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: REQUIRED_IMAGE_MODEL,
        prompt: asset.prompt,
        size: process.env.ASSET_IMAGE_SIZE ?? "1024x1024",
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI image generation failed for ${asset.id}: ${response.status} ${body}`);
    }

    const payload = (await response.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
    const image = payload.data?.[0];
    let bytes: Buffer;

    if (image?.b64_json) {
      bytes = Buffer.from(image.b64_json, "base64");
    } else if (image?.url) {
      const imageResponse = await fetch(image.url);
      if (!imageResponse.ok) {
        throw new Error(`Could not download generated image for ${asset.id}: ${imageResponse.status}`);
      }
      bytes = Buffer.from(await imageResponse.arrayBuffer());
    } else {
      throw new Error(`OpenAI image generation returned no image data for ${asset.id}.`);
    }

    await fs.writeFile(path.join(generatedAssetsDir, asset.fileName), bytes);
    generatedIds.push(asset.id);
  }

  return writeGeneratedAssetManifest(generatedIds);
}
