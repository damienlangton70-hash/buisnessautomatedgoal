#!/usr/bin/env node

import { writeFile, mkdir, readFile, readdir, unlink } from "fs/promises";
import { join } from "path";
import { fileURLToPath } from "url";
import { pickThemes } from "./themes/themes.mjs";
import {
  makeSeamless,
  prepareObject,
  createTilesetPreview,
  createPlaceholderTile,
  DEFAULT_TILE_SIZE,
} from "./tile-processor.mjs";
import { isoWeek, utcDateStamp } from "./lib/week.mjs";
import { resolveProvider } from "./lib/image-provider.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = join(__dirname, "..");
// DATA_DIR lets the test suite (and anyone with a read-only checkout) work in a
// scratch directory instead of the repo's data/daily.
const dataDir = process.env.DATA_DIR || join(projectRoot, "data", "daily");

const { TEST_MODE, TILE_SIZE, TILESETS_PER_RUN } = process.env;

const isTest = TEST_MODE === "true";

export const PLACEHOLDER_SOURCE = "test-placeholder";
const tileSize = Number(TILE_SIZE) || DEFAULT_TILE_SIZE;
const tilesetsPerRun = Number(TILESETS_PER_RUN) || 5;

// floor, wall, building
const IMAGES_PER_TILESET = 3;

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
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

async function generateImage(provider, prompt, filepath, label) {
  if (isTest) {
    await createPlaceholderTile(filepath, `${label}:${prompt}`, label);
    log(`  [test] synthesised ${label}`);
    return filepath;
  }

  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const buffer = await provider.generate(prompt);
      await writeFile(filepath, buffer);
      log(`  generated ${label} (${(buffer.length / 1024).toFixed(0)} KB)`);
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

async function buildTileset(provider, theme, assetId) {
  const raw = {
    floor: join(dataDir, `${assetId}-floor-raw.png`),
    wall: join(dataDir, `${assetId}-wall-raw.png`),
    building: join(dataDir, `${assetId}-building-raw.png`),
  };

  await generateImage(provider, theme.prompts.floor, raw.floor, "floor");
  await generateImage(provider, theme.prompts.wall, raw.wall, "wall");
  await generateImage(provider, theme.prompts.building, raw.building, "building");

  const out = {
    floor: join(dataDir, `${assetId}-floor.png`),
    wall: join(dataDir, `${assetId}-wall.png`),
    building: join(dataDir, `${assetId}-building.png`),
    preview: join(dataDir, `${assetId}-preview.png`),
  };

  await makeSeamless(raw.floor, out.floor, tileSize);
  await makeSeamless(raw.wall, out.wall, tileSize);

  // The building is a single object on a flat black backdrop, so it gets the
  // backdrop knocked out to transparency and is NOT run through the seamless
  // pass, which would smear it across its own edges.
  await prepareObject(raw.building, out.building, tileSize);

  await createTilesetPreview(
    [
      { path: out.floor, repeat: 2 },
      { path: out.wall, repeat: 2 },
      { path: out.building, repeat: 1 },
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
    // Every asset records how its pixels were made. A placeholder that reaches
    // a pack is a refund, so this travels with the asset and the bundler
    // refuses to ship any asset that is not real output.
    source: isTest ? PLACEHOLDER_SOURCE : provider.id,
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
      building: `${assetId}-building.png`,
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

  // Resolve the provider before spending anything, so a missing key fails on
  // line one rather than after three images.
  const provider = isTest ? null : resolveProvider();

  const fragmentPath = join(dataDir, `day-${week.id}-${date}.json`);
  let existing = { assets: [], failures: [] };
  try {
    existing = JSON.parse(await readFile(fragmentPath, "utf8"));
  } catch {
    /* first run of the day */
  }
  const indexOffset = existing.assets?.length ?? 0;

  // The 5 Sept incident: a real run failed every image, then a TEST_MODE run
  // merged five placeholder tilesets into the same day fragment, and the
  // bundler shipped them. Never mix the two.
  const existingIsTest = existing.assets?.some(
    (a) => a.source === PLACEHOLDER_SOURCE,
  );
  if (existing.assets?.length && existingIsTest !== isTest) {
    throw new Error(
      `Refusing to merge: ${fragmentPath} already holds ` +
        `${existingIsTest ? "placeholder" : "real"} assets and this is a ` +
        `${isTest ? "TEST_MODE" : "real"} run. Move or delete that fragment first.`,
    );
  }

  const used = await usedThemesThisWeek(week.id);
  const themes = pickThemes(tilesetsPerRun, used);

  log(`Week ${week.id}, run date ${date}`);
  log(`Themes already used this week: ${used.length ? used.join(", ") : "none"}`);
  log(`Today: ${themes.map((t) => t.key).join(", ")}`);
  if (!isTest) {
    const images = tilesetsPerRun * IMAGES_PER_TILESET;
    log(
      `Provider: ${provider.id} — estimated spend ` +
        `$${(images * provider.costPerImageUsd).toFixed(2)} for ${images} images`,
    );
  }

  const assets = [];
  const failures = [];

  for (const [i, theme] of themes.entries()) {
    const assetId = `${week.id}-${date.replace(/-/g, "")}-${indexOffset + i + 1}`;
    log(`\n[${i + 1}/${themes.length}] ${theme.name} (${assetId})`);

    try {
      assets.push(await buildTileset(provider, theme, assetId));
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
