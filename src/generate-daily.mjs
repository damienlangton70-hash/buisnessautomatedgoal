#!/usr/bin/env node

import { writeFile, mkdir, readFile, readdir, unlink } from "fs/promises";
import { join } from "path";
import { fileURLToPath } from "url";
import { pickThemes } from "./themes/themes.mjs";
import {
  makeSeamless,
  prepareProp,
  createTilesetPreview,
  createPlaceholderTile,
  DEFAULT_TILE_SIZE,
} from "./tile-processor.mjs";
import { isoWeek, utcDateStamp } from "./lib/week.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = join(__dirname, "..");
// DATA_DIR lets the test suite (and anyone with a read-only checkout) work in a
// scratch directory instead of the repo's data/daily.
const dataDir = process.env.DATA_DIR || join(projectRoot, "data", "daily");

const {
  OPENAI_API_KEY,
  TEST_MODE,
  IMAGE_QUALITY = "hd",
  TILE_SIZE,
  TILESETS_PER_RUN,
} = process.env;

const isTest = TEST_MODE === "true";
const tileSize = Number(TILE_SIZE) || DEFAULT_TILE_SIZE;
const tilesetsPerRun = Number(TILESETS_PER_RUN) || 5;

// DALL-E 3, 1024x1024. Kept here so the run log states the real spend rather
// than the wildly optimistic figure the docs used to carry.
const COST_PER_IMAGE_USD = IMAGE_QUALITY === "hd" ? 0.08 : 0.04;
const IMAGES_PER_TILESET = 3;

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

async function loadOpenAI() {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not set. See .env.example");
  }
  const { default: OpenAI } = await import("openai");
  return new OpenAI({ apiKey: OPENAI_API_KEY });
}

/**
 * Theme keys already used earlier this ISO week, so today's picks don't repeat
 * them. In CI the previous days' fragments are restored from the run
 * artifacts before this script starts.
 */
async function usedThemesThisWeek(weekId) {
  try {
    const files = await readdir(dataDir);
    const used = [];
    for (const f of files) {
      if (!f.startsWith(`day-${weekId}-`) || !f.endsWith(".json")) continue;
      const frag = JSON.parse(await readFile(join(dataDir, f), "utf8"));
      for (const asset of frag.assets ?? []) used.push(asset.themeKey);
    }
    return used;
  } catch {
    return [];
  }
}

async function generateImage(openai, prompt, filepath, label) {
  if (isTest) {
    await createPlaceholderTile(filepath, `${label}:${prompt}`, label);
    log(`  [test] synthesised ${label}`);
    return filepath;
  }

  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1024x1024",
        quality: IMAGE_QUALITY,
      });

      const imageUrl = response.data?.[0]?.url;
      if (!imageUrl) throw new Error("No image URL returned from DALL-E");

      const imgResponse = await fetch(imageUrl);
      if (!imgResponse.ok) {
        throw new Error(`Image download failed: ${imgResponse.status}`);
      }

      await writeFile(filepath, Buffer.from(await imgResponse.arrayBuffer()));
      log(`  generated ${label}`);
      return filepath;
    } catch (error) {
      lastError = error;
      log(`  [retry ${attempt}/3] ${label}: ${error.message}`);
      if (attempt < 3) await sleep(4000 * attempt);
    }
  }
  throw lastError;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function buildTileset(openai, theme, assetId) {
  const raw = {
    floor: join(dataDir, `${assetId}-floor-raw.png`),
    wall: join(dataDir, `${assetId}-wall-raw.png`),
    prop: join(dataDir, `${assetId}-prop-raw.png`),
  };

  await generateImage(openai, theme.prompts.floor, raw.floor, "floor");
  await generateImage(openai, theme.prompts.wall, raw.wall, "wall");
  await generateImage(openai, theme.prompts.prop, raw.prop, "prop");

  const out = {
    floor: join(dataDir, `${assetId}-floor.png`),
    wall: join(dataDir, `${assetId}-wall.png`),
    prop: join(dataDir, `${assetId}-prop.png`),
    preview: join(dataDir, `${assetId}-preview.png`),
  };

  await makeSeamless(raw.floor, out.floor, tileSize);
  await makeSeamless(raw.wall, out.wall, tileSize);
  await prepareProp(raw.prop, out.prop, tileSize);

  await createTilesetPreview(
    [
      { path: out.floor, repeat: 2 },
      { path: out.wall, repeat: 2 },
      { path: out.prop, repeat: 1 },
    ],
    out.preview,
    3,
    tileSize,
  );

  // Raw 1024px originals are intermediates. Keeping them roughly tripled the
  // size of every run for no benefit to the buyer.
  await Promise.all(Object.values(raw).map((p) => unlink(p).catch(() => {})));

  return {
    id: assetId,
    themeKey: theme.key,
    theme: theme.name,
    description: theme.description,
    tags: theme.tags,
    color: theme.color,
    tileSize,
    generatedAt: new Date().toISOString(),
    files: {
      floor: `${assetId}-floor.png`,
      wall: `${assetId}-wall.png`,
      prop: `${assetId}-prop.png`,
      preview: `${assetId}-preview.png`,
    },
  };
}

async function main() {
  log("=== DarkDragonAssets: daily generation ===");

  await mkdir(dataDir, { recursive: true });

  const now = new Date();
  const week = isoWeek(now);
  const date = utcDateStamp(now);

  const openai = isTest ? null : await loadOpenAI();

  const fragmentPath = join(dataDir, `day-${week.id}-${date}.json`);
  let existing = { assets: [], failures: [] };
  try {
    existing = JSON.parse(await readFile(fragmentPath, "utf8"));
  } catch {
    /* first run of the day */
  }
  const indexOffset = existing.assets?.length ?? 0;

  const used = await usedThemesThisWeek(week.id);
  const themes = pickThemes(tilesetsPerRun, used);

  log(`Week ${week.id}, run date ${date}`);
  log(`Themes already used this week: ${used.length ? used.join(", ") : "none"}`);
  log(`Today: ${themes.map((t) => t.key).join(", ")}`);
  if (!isTest) {
    const est = tilesetsPerRun * IMAGES_PER_TILESET * COST_PER_IMAGE_USD;
    log(
      `Estimated spend: $${est.toFixed(2)} (${tilesetsPerRun * IMAGES_PER_TILESET} images @ ${IMAGE_QUALITY})`,
    );
  }

  const assets = [];
  const failures = [];

  for (const [i, theme] of themes.entries()) {
    const assetId = `${week.id}-${date.replace(/-/g, "")}-${indexOffset + i + 1}`;
    log(`\n[${i + 1}/${themes.length}] ${theme.name} (${assetId})`);

    try {
      assets.push(await buildTileset(openai, theme, assetId));
      log(`  done`);
    } catch (error) {
      // One bad tileset should not throw away the ones already paid for.
      failures.push({ theme: theme.key, error: error.message });
      log(`  [FAILED] ${error.message}`);
    }
  }

  // Merge into any fragment already written today rather than replacing it, so
  // a re-run (a retry after a partial failure, or a manual dispatch) adds to
  // the day instead of silently discarding tilesets already paid for.
  await writeFile(
    fragmentPath,
    JSON.stringify(
      {
        weekId: week.id,
        year: week.year,
        week: week.week,
        date,
        generatedAt: existing.generatedAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tileSize,
        quality: isTest ? "test-placeholder" : IMAGE_QUALITY,
        assets: [...(existing.assets ?? []), ...assets],
        failures: [...(existing.failures ?? []), ...failures],
      },
      null,
      2,
    ),
  );

  log(`\n=== Complete ===`);
  log(`Tilesets: ${assets.length} built, ${failures.length} failed`);
  log(`Files: ${assets.length * 4} PNGs at ${tileSize}x${tileSize}`);
  log(`Fragment: ${fragmentPath}`);

  // A run where every tileset failed is a real failure and should go red in CI.
  if (assets.length === 0) {
    throw new Error("No tilesets were produced");
  }
}

main().catch((error) => {
  log(`[ERROR] ${error.message}`);
  process.exit(1);
});
