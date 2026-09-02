#!/usr/bin/env node

/**
 * Publish a weekly pack to itch.io via butler.
 *
 * The previous version POSTed to
 *   https://itch.io/api/1/{user}/{gameid}/uploads
 * which does not exist. itch.io's server-side API is read-only — it can tell
 * you about your profile, your games, download keys and purchases, and nothing
 * else. Publishing a build is only possible through butler, itch.io's official
 * upload tool. So the entire revenue path silently 404'd.
 *
 * Each week is pushed to its own butler channel (named after the ISO week), so
 * weekly packs accumulate as separate uploads on the game page rather than
 * replacing one another — which is what the "backlog keeps selling" model
 * depends on. Pushing every week to one channel would overwrite last week.
 */

import { access, readdir } from "fs/promises";
import { join } from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import { isoWeek } from "./lib/week.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const distDir = process.env.DIST_DIR || join(__dirname, "..", "dist");

const {
  BUTLER_API_KEY,
  ITCHIO_USERNAME,
  ITCHIO_GAME_SLUG,
  WEEK_ID,
  DRY_RUN,
} = process.env;

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${cmd} exited with code ${code}`)),
    );
  });
}

async function main() {
  const weekId = WEEK_ID || isoWeek().id;
  const stageDir = join(distDir, weekId);

  try {
    await access(stageDir);
  } catch {
    throw new Error(
      `Nothing staged for week ${weekId} at ${stageDir}. Run: npm run bundle:weekly`,
    );
  }

  const staged = await readdir(stageDir);
  if (!staged.length) throw new Error(`${stageDir} is empty`);
  log(`Staged for ${weekId}: ${staged.join(", ")}`);

  if (DRY_RUN === "true") {
    log("[dry run] Skipping butler push");
    return;
  }

  const missing = [
    ["BUTLER_API_KEY", BUTLER_API_KEY],
    ["ITCHIO_USERNAME", ITCHIO_USERNAME],
    ["ITCHIO_GAME_SLUG", ITCHIO_GAME_SLUG],
  ]
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length) {
    throw new Error(
      `Missing credentials: ${missing.join(", ")}. ` +
        `Note ITCHIO_GAME_SLUG is the URL slug (e.g. "weekly-asset-pack"), ` +
        `not the numeric game ID — butler addresses games by slug.`,
    );
  }

  const target = `${ITCHIO_USERNAME}/${ITCHIO_GAME_SLUG}:week-${weekId}`;
  log(`butler push ${stageDir} ${target}`);

  await run("butler", [
    "push",
    stageDir,
    target,
    "--userversion",
    weekId,
    "--if-changed",
  ]);

  log(`Published: https://${ITCHIO_USERNAME}.itch.io/${ITCHIO_GAME_SLUG}`);
}

main().catch((error) => {
  log(`[ERROR] ${error.message}`);
  process.exit(1);
});
