#!/usr/bin/env node

import { readFile, readdir, mkdir, writeFile } from "fs/promises";
import { createWriteStream } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import archiver from "archiver";
import { isoWeek } from "./lib/week.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = join(__dirname, "..");
const dataDir = process.env.DATA_DIR || join(projectRoot, "data", "daily");
const distDir = process.env.DIST_DIR || join(projectRoot, "dist");

const { WEEK_ID } = process.env;

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

/**
 * Merge the per-day fragments into one weekly manifest.
 *
 * The old design kept a single mutable week-*.json that each day rewrote, and
 * the workflow committed the PNGs to git so the Saturday job could see them.
 * Days are now independent fragments handed between runs as CI artifacts, so
 * nothing binary ever enters the repository.
 */
async function collectWeek(weekId) {
  const files = (await readdir(dataDir)).filter(
    (f) => f.startsWith(`day-${weekId}-`) && f.endsWith(".json"),
  );

  if (!files.length) {
    throw new Error(
      `No day fragments found for week ${weekId} in ${dataDir}. ` +
        `Did the weekday generate runs upload their artifacts?`,
    );
  }

  files.sort();

  const assets = [];
  const days = [];
  let tileSize = null;

  for (const f of files) {
    const frag = JSON.parse(await readFile(join(dataDir, f), "utf8"));
    days.push({ date: frag.date, count: frag.assets.length });
    tileSize ??= frag.tileSize;
    assets.push(...frag.assets);
  }

  return { weekId, tileSize, days, assets };
}

function packReadme(manifest) {
  const themes = manifest.assets
    .map((a, i) => `- **${a.theme}** — ${a.description}`)
    .join("\n");

  return `# DarkDragon Weekly Asset Pack — ${manifest.weekId}

**Tilesets:** ${manifest.assets.length}
**Files:** ${manifest.assets.length * 4} PNGs
**Tile size:** ${manifest.tileSize}x${manifest.tileSize}

## Contents

Each numbered folder is one tileset:

- \`floor.png\` — seamless floor tile, tiles on all four edges
- \`wall.png\` — seamless wall tile, tiles on all four edges
- \`prop.png\` — single prop with a transparent background
- \`preview.png\` — preview grid (floor and wall shown as a 2x2 repeat)

\`manifest.json\` lists every tileset with its theme, tags and colour, so you
can script imports into your engine.

## Themes in this pack

${themes}

## AI disclosure

The images in this pack were produced with generative AI (OpenAI DALL-E 3) and
then processed for seamless tiling. This is disclosed on the itch.io listing in
line with itch.io's generative AI disclosure policy.

## License

Personal and commercial use permitted, including in commercial games. You may
modify and redistribute the tiles as part of a game or product. Do not resell
the pack itself as an asset pack. Attribution appreciated but not required.

---

Pack ${manifest.weekId} — DarkDragonAssets
`;
}

async function createZipBundle(manifest, outputPath) {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () =>
      resolve({ path: outputPath, bytes: archive.pointer() }),
    );
    archive.on("error", reject);
    output.on("error", reject);
    archive.pipe(output);

    manifest.assets.forEach((asset, i) => {
      const folder = `${String(i + 1).padStart(2, "0")}-${asset.themeKey}`;
      for (const [kind, filename] of Object.entries(asset.files)) {
        archive.file(join(dataDir, filename), {
          name: `${folder}/${kind}.png`,
        });
      }
    });

    archive.append(JSON.stringify(manifest, null, 2), { name: "manifest.json" });
    archive.append(packReadme(manifest), { name: "README.md" });
    archive.finalize();
  });
}

async function main() {
  log("=== DarkDragonAssets: weekly bundle ===");

  const weekId = WEEK_ID || isoWeek().id;
  const manifest = await collectWeek(weekId);

  log(`Week ${weekId}`);
  for (const d of manifest.days) log(`  ${d.date}: ${d.count} tilesets`);
  log(`Total: ${manifest.assets.length} tilesets`);

  const uniqueThemes = new Set(manifest.assets.map((a) => a.themeKey)).size;
  log(`Distinct themes: ${uniqueThemes}/${manifest.assets.length}`);

  if (manifest.assets.length === 0) {
    throw new Error("Week contains no assets — refusing to publish an empty pack");
  }

  // butler pushes a directory, so the zip is staged inside one.
  const stageDir = join(distDir, weekId);
  await mkdir(stageDir, { recursive: true });

  const zipName = `darkdragon-week-${weekId}.zip`;
  const { path, bytes } = await createZipBundle(
    manifest,
    join(stageDir, zipName),
  );

  await writeFile(
    join(distDir, `manifest-${weekId}.json`),
    JSON.stringify(manifest, null, 2),
  );

  log(`\n=== Complete ===`);
  log(`ZIP: ${path} (${(bytes / 1048576).toFixed(1)} MB)`);
  log(`Stage dir: ${stageDir}`);
  log(`Publish with: npm run publish:weekly`);
}

main().catch((error) => {
  log(`[ERROR] ${error.message}`);
  process.exit(1);
});
