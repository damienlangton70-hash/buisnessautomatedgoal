#!/usr/bin/env node

/**
 * End-to-end pipeline check with no API spend.
 *
 * Runs the real generate + bundle scripts in TEST_MODE (which synthesises tiles
 * locally instead of calling DALL-E), then asserts the things that were
 * actually broken: that tiles come out at the right size, that floor and wall
 * tiles genuinely wrap, that props have transparency, that no theme repeats
 * within a week, and that the zip contains what the pack README promises.
 */

import { spawnSync } from "child_process";
import { mkdtemp, readdir, rm, readFile, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";
import Jimp from "jimp";
import { isoWeek } from "../src/lib/week.mjs";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");

// The test runs entirely in a scratch directory, so it never touches (or has
// to delete anything in) the repo's own data/daily or dist.
const scratch = await mkdtemp(join(tmpdir(), "dda-test-"));
const dataDir = join(scratch, "data");
const distDir = join(scratch, "dist");

let failures = 0;

function check(name, ok, detail = "") {
  console.log(`${ok ? "  PASS" : "  FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

function runScript(script, env) {
  const result = spawnSync("node", [script], {
    cwd: root,
    env: { ...process.env, DATA_DIR: dataDir, DIST_DIR: distDir, ...env },
    encoding: "utf8",
  });
  if (result.status !== 0) {
    console.error(result.stdout);
    console.error(result.stderr);
    throw new Error(`${script} exited ${result.status}`);
  }
  return result.stdout;
}

/** Mean absolute difference between the tile's opposite edges. */
async function wrapError(path) {
  const img = await Jimp.read(path);
  const { width, height, data } = img.bitmap;
  let total = 0;
  let n = 0;

  for (let y = 0; y < height; y++) {
    const l = (y * width) * 4;
    const r = (y * width + width - 1) * 4;
    for (let c = 0; c < 3; c++) total += Math.abs(data[l + c] - data[r + c]);
    n += 3;
  }
  for (let x = 0; x < width; x++) {
    const t = x * 4;
    const b = ((height - 1) * width + x) * 4;
    for (let c = 0; c < 3; c++) total += Math.abs(data[t + c] - data[b + c]);
    n += 3;
  }
  return total / n;
}

/** Mean absolute difference between two adjacent interior columns, as a baseline. */
async function interiorError(path) {
  const img = await Jimp.read(path);
  const { width, height, data } = img.bitmap;
  let total = 0;
  let n = 0;
  const a = Math.floor(width * 0.3);
  for (let y = 0; y < height; y++) {
    const i = (y * width + a) * 4;
    const j = (y * width + a + 1) * 4;
    for (let c = 0; c < 3; c++) total += Math.abs(data[i + c] - data[j + c]);
    n += 3;
  }
  return total / n;
}

async function main() {
  console.log("=== DarkDragonAssets pipeline test (no API spend) ===\n");

  await mkdir(dataDir, { recursive: true });
  console.log(`Scratch: ${scratch}\n`);

  const week = isoWeek().id;
  const tileSize = 256; // smaller than production, keeps the test quick

  console.log("Running two daily generations...");
  runScript("src/generate-daily.mjs", {
    TEST_MODE: "true",
    TILE_SIZE: String(tileSize),
    TILESETS_PER_RUN: "3",
  });
  runScript("src/generate-daily.mjs", {
    TEST_MODE: "true",
    TILE_SIZE: String(tileSize),
    TILESETS_PER_RUN: "3",
  });

  const files = await readdir(dataDir);
  const fragments = files.filter((f) => f.startsWith("day-") && f.endsWith(".json"));

  console.log("\nGeneration:");
  check("day fragments written", fragments.length >= 1, `${fragments.length} found`);

  const assets = [];
  for (const f of fragments) {
    const frag = JSON.parse(await readFile(join(dataDir, f), "utf8"));
    assets.push(...frag.assets);
    check(
      `no failures in ${f}`,
      frag.failures.length === 0,
      frag.failures.map((x) => x.error).join("; "),
    );
  }

  check("six tilesets across both runs", assets.length === 6, `got ${assets.length}`);

  const themeKeys = assets.map((a) => a.themeKey);
  check(
    "no theme repeats within the week",
    new Set(themeKeys).size === themeKeys.length,
    themeKeys.join(", "),
  );

  check("raw intermediates cleaned up", !files.some((f) => f.includes("-raw.")));

  console.log("\nImage pipeline:");
  const sample = assets[0];

  const floor = await Jimp.read(join(dataDir, sample.files.floor));
  check(
    `floor resized to ${tileSize}x${tileSize}`,
    floor.bitmap.width === tileSize && floor.bitmap.height === tileSize,
    `${floor.bitmap.width}x${floor.bitmap.height}`,
  );

  const preview = await Jimp.read(join(dataDir, sample.files.preview));
  check(
    "preview grid is 3 cells wide",
    preview.bitmap.width === tileSize * 3 && preview.bitmap.height === tileSize,
    `${preview.bitmap.width}x${preview.bitmap.height}`,
  );

  // A seamless tile's opposite edges should match about as closely as any two
  // neighbouring interior columns do.
  for (const kind of ["floor", "wall"]) {
    const p = join(dataDir, sample.files[kind]);
    const wrapErr = await wrapError(p);
    const interior = await interiorError(p);
    check(
      `${kind} tile wraps seamlessly`,
      wrapErr <= interior * 1.5 + 1,
      `edge delta ${wrapErr.toFixed(2)} vs interior ${interior.toFixed(2)}`,
    );
  }

  const prop = await Jimp.read(join(dataDir, sample.files.prop));
  let transparent = 0;
  prop.scan(0, 0, prop.bitmap.width, prop.bitmap.height, function (x, y, idx) {
    if (this.bitmap.data[idx + 3] === 0) transparent++;
  });
  check(
    "prop background knocked out",
    transparent > 0,
    `${transparent} transparent px`,
  );

  console.log("\nBundle:");
  const out = runScript("src/bundle-weekly.mjs", { WEEK_ID: week });
  check("bundle reports all six tilesets", /Total: 6 tilesets/.test(out));
  check("bundle reports six distinct themes", /Distinct themes: 6\/6/.test(out));

  const staged = await readdir(join(distDir, week));
  check("zip staged for butler", staged.some((f) => f.endsWith(".zip")), staged.join(", "));

  const zipList = spawnSync("unzip", ["-Z1", join(distDir, week, staged[0])], {
    encoding: "utf8",
  }).stdout.trim().split("\n");

  check("zip contains manifest.json", zipList.includes("manifest.json"));
  check("zip contains README.md", zipList.includes("README.md"));
  check(
    "zip uses per-tileset folders with clean names",
    zipList.filter((f) => /^\d\d-[a-z-]+\/floor\.png$/.test(f)).length === 6,
  );
  check("zip has 24 PNGs", zipList.filter((f) => f.endsWith(".png")).length === 24);

  console.log("\nPublish (dry run):");
  const pub = runScript("src/publish-itchio.mjs", { WEEK_ID: week, DRY_RUN: "true" });
  check("publish finds the staged pack", /Staged for/.test(pub));

  await rm(scratch, { recursive: true, force: true }).catch(() => {});

  console.log(
    `\n=== ${failures === 0 ? "All checks passed" : `${failures} check(s) FAILED`} ===`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
