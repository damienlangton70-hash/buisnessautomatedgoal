#!/usr/bin/env node

import { writeFile, mkdir, readFile } from "fs/promises";
import { join } from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import { getRandomTheme } from "./themes/themes.mjs";
import { makeSeamless, createTilesetPreview } from "./tile-processor.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = join(__dirname, "..");
const dataDir = join(projectRoot, "data", "daily");

const { OPENAI_API_KEY, TEST_MODE, GITHUB_RUN_ID } = process.env;

const ASSETS_PER_RUN = 5;

async function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

async function ensureApiKeys() {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not set. See .env.example");
  }
}

async function getWeeklyManifest() {
  const now = new Date();
  const jan4 = new Date(now.getFullYear(), 0, 4);
  const msPerDay = 86400000;
  const weekNum = Math.ceil(
    ((now.getTime() - jan4.getTime()) / msPerDay + jan4.getDay() + 1) / 7,
  );
  const year = now.getFullYear();
  const week = String(weekNum).padStart(2, "0");

  const manifestPath = join(dataDir, `week-${year}-${week}.json`);

  try {
    const raw = await readFile(manifestPath, "utf8");
    return { manifest: JSON.parse(raw), manifestPath, week, year };
  } catch {
    const newManifest = {
      year,
      week,
      generatedAt: new Date().toISOString(),
      assets: [],
    };
    await mkdir(dataDir, { recursive: true });
    await writeFile(manifestPath, JSON.stringify(newManifest, null, 2));
    return { manifest: newManifest, manifestPath, week, year };
  }
}

async function generateTileImage(prompt, filename) {
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1024",
      quality: "hd",
    });

    if (!response.data || response.data.length === 0) {
      throw new Error("No images returned from DALL-E");
    }

    const imageUrl = response.data[0].url;
    log(`  Generated: ${filename}`);

    const imgResponse = await fetch(imageUrl);
    if (!imgResponse.ok) {
      throw new Error(`Failed to download image: ${imgResponse.status}`);
    }

    const buffer = await imgResponse.arrayBuffer();
    const filepath = join(dataDir, filename);
    await writeFile(filepath, Buffer.from(buffer));
    return filepath;
  } catch (error) {
    log(`  [ERROR] ${filename}: ${error.message}`);
    throw error;
  }
}

async function main() {
  try {
    log("=== DarkDragonAssets: Daily Generation ===");
    await ensureApiKeys();

    const { manifest, manifestPath, week, year } = await getWeeklyManifest();
    log(
      `[Manifest] Week ${year}-${week} (${manifest.assets.length} assets so far)`,
    );

    const dayOfWeek = new Date().toLocaleDateString("en-US", {
      weekday: "long",
    });
    const runDate = new Date().toISOString().split("T")[0];
    log(`[Run] ${runDate} (${dayOfWeek})`);

    const runAssets = [];

    for (let i = 1; i <= ASSETS_PER_RUN; i++) {
      log(`\n[Asset ${i}/${ASSETS_PER_RUN}]`);

      const theme = getRandomTheme();
      log(`  Theme: ${theme.name}`);

      const assetId = `${year}-${week}-${String(runDate.replace(/-/g, "")).slice(-6)}-${i}`;

      const floorPath = await generateTileImage(
        theme.prompts.floor,
        `${assetId}-floor-raw.png`,
      );
      const wallPath = await generateTileImage(
        theme.prompts.wall,
        `${assetId}-wall-raw.png`,
      );
      const propPath = await generateTileImage(
        theme.prompts.prop,
        `${assetId}-prop-raw.png`,
      );

      log(`  Processing: seamless tiling`);
      const floorProcessed = join(dataDir, `${assetId}-floor.png`);
      const wallProcessed = join(dataDir, `${assetId}-wall.png`);
      const propProcessed = join(dataDir, `${assetId}-prop.png`);

      await makeSeamless(floorPath, floorProcessed);
      await makeSeamless(wallPath, wallProcessed);
      await makeSeamless(propPath, propProcessed);

      log(`  Creating preview`);
      const previewPath = join(dataDir, `${assetId}-preview.png`);
      await createTilesetPreview(
        [floorProcessed, wallProcessed, propProcessed],
        previewPath,
        3,
        256,
      );

      const assetRecord = {
        id: assetId,
        theme: theme.name,
        description: theme.description,
        tags: theme.tags,
        generatedAt: new Date().toISOString(),
        files: {
          floor: `${assetId}-floor.png`,
          wall: `${assetId}-wall.png`,
          prop: `${assetId}-prop.png`,
          preview: `${assetId}-preview.png`,
        },
      };

      manifest.assets.push(assetRecord);
      runAssets.push(assetRecord);

      log(`  ✓ Asset stored (total: ${manifest.assets.length})`);
    }

    manifest.updatedAt = new Date().toISOString();
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    log(`\n[Manifest] Updated: ${manifestPath}`);

    log(`\n=== Complete ===`);
    log(`Generated: ${ASSETS_PER_RUN} tilesets`);
    log(`Files: ${ASSETS_PER_RUN * 4} (floor, wall, prop, preview each)`);
    log(`Weekly total: ${manifest.assets.length} assets`);
    log(`Storage: ${dataDir}`);

    if (!TEST_MODE) {
      log(`\n[Saturday] This week's bundle will upload ~${manifest.assets.length} assets`);
    }
  } catch (error) {
    log(`[ERROR] ${error.message}`);
    process.exit(1);
  }
}

main();
