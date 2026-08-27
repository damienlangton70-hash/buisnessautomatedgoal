#!/usr/bin/env node

import { writeFile, readFile, mkdir } from "fs/promises";
import { createWriteStream } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import archiver from "archiver";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = join(__dirname, "..");
const dataDir = join(projectRoot, "data", "daily");

const {
  OPENAI_API_KEY,
  ITCHIO_API_KEY,
  ITCHIO_USERNAME,
  ITCHIO_GAME_ID,
  TEST_MODE,
} = process.env;

async function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

async function ensureApiKeys() {
  if (!ITCHIO_API_KEY || !ITCHIO_USERNAME || !ITCHIO_GAME_ID) {
    throw new Error(
      "itch.io credentials missing. Set ITCHIO_API_KEY, ITCHIO_USERNAME, ITCHIO_GAME_ID",
    );
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
    throw new Error(`No manifest found for week ${year}-${week}`);
  }
}

async function createZipBundle(manifest, outputPath) {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    log(`[ZIP] Creating archive: ${outputPath}`);

    output.on("close", () => {
      log(`[ZIP] Complete: ${archive.pointer()} bytes`);
      resolve(outputPath);
    });

    archive.on("error", reject);
    output.on("error", reject);

    archive.pipe(output);

    for (const asset of manifest.assets) {
      const assetDir = asset.id;
      for (const [key, filename] of Object.entries(asset.files)) {
        const filepath = join(dataDir, filename);
        archive.file(filepath, { name: `${assetDir}/${filename}` });
      }
    }

    archive.append(JSON.stringify(manifest, null, 2), {
      name: "manifest.json",
    });

    const readme = `# DarkDragon Weekly Asset Pack

**Week:** ${manifest.year}-${manifest.week}
**Assets:** ${manifest.assets.length} tilesets (${manifest.assets.length * 3} tile types)
**Generated:** ${manifest.generatedAt}
**Updated:** ${manifest.updatedAt}

## Contents

Each tileset folder contains:
- \`floor.png\` — Seamless floor tile (256×256)
- \`wall.png\` — Wall element (256×256)
- \`prop.png\` — Decorative prop (256×256)
- \`preview.png\` — Preview grid

## Themes This Week

${manifest.assets.map((a) => `- **${a.theme}** — ${a.description}`).join("\n")}

## License

Personal & commercial use permitted. Attribution appreciated.

---

Pack created by DarkDragonAssets
`;
    archive.append(readme, { name: "README.md" });

    archive.finalize();
  });
}

async function uploadToItchio(zipPath, manifest) {
  const week = manifest.week;
  const year = manifest.year;
  const assetCount = manifest.assets.length;

  log(`[itch.io] Uploading week ${year}-${week} (${assetCount} assets)`);

  try {
    const fileBuffer = await readFile(zipPath);

    const formData = new FormData();
    formData.append("api_key", ITCHIO_API_KEY);
    formData.append("upload", new Blob([fileBuffer]), `week-${year}-${week}.zip`);
    formData.append(
      "build_file_size",
      fileBuffer.length.toString(),
    );

    const url = `https://itch.io/api/1/${ITCHIO_USERNAME}/${ITCHIO_GAME_ID}/uploads`;

    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Upload failed: ${response.status} ${text}`);
    }

    const result = await response.json();
    log(`[itch.io] ✓ Upload successful`);
    log(`[itch.io] URL: ${result.url || "Check your game page"}`);

    return result;
  } catch (error) {
    log(`[itch.io ERROR] ${error.message}`);
    throw error;
  }
}

async function main() {
  try {
    log("=== DarkDragonAssets: Weekly Bundle ===");

    const { manifest, manifestPath, week, year } = await getWeeklyManifest();
    log(`[Manifest] Week ${year}-${week}: ${manifest.assets.length} assets`);

    if (manifest.assets.length === 0) {
      log("[Warning] No assets generated this week. Skipping upload.");
      return;
    }

    const zipPath = join(dataDir, `week-${year}-${week}.zip`);
    await createZipBundle(manifest, zipPath);

    if (!TEST_MODE) {
      await ensureApiKeys();
      await uploadToItchio(zipPath, manifest);
    } else {
      log("[Test Mode] Skipping itch.io upload");
    }

    log(`\n=== Complete ===`);
    log(`Week: ${year}-${week}`);
    log(`Assets: ${manifest.assets.length} tilesets`);
    log(`Files: ${manifest.assets.length * 4} PNG files`);
    log(`ZIP: ${zipPath}`);
  } catch (error) {
    log(`[ERROR] ${error.message}`);
    process.exit(1);
  }
}

main();
