#!/usr/bin/env node

import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { isoWeek } from "./lib/week.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const distDir = process.env.DIST_DIR || join(__dirname, "..", "dist");

const { BUTLER_API_KEY, ITCHIO_USERNAME, ITCHIO_GAME_SLUG, WEEK_ID } = process.env;

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function uploadToItchio() {
  const weekId = WEEK_ID || isoWeek().id;
  const stageDir = join(distDir, weekId);

  // Validate
  if (!BUTLER_API_KEY || !ITCHIO_USERNAME || !ITCHIO_GAME_SLUG) {
    throw new Error("Missing: BUTLER_API_KEY, ITCHIO_USERNAME, ITCHIO_GAME_SLUG");
  }

  // Find ZIP file
  const files = readdirSync(stageDir);
  const zipFile = files.find((f) => f.endsWith(".zip"));
  if (!zipFile) throw new Error(`No ZIP found in ${stageDir}`);

  const zipPath = join(stageDir, zipFile);
  const fileBuffer = readFileSync(zipPath);

  log(`Uploading: ${zipFile} (${(fileBuffer.length / 1024 / 1024).toFixed(1)} MB)`);

  // Upload via itch.io HTTP API
  const uploadUrl = `https://itch.io/api/1/${ITCHIO_USERNAME}/${ITCHIO_GAME_SLUG}/uploads`;
  const formData = new FormData();
  formData.append("api_key", BUTLER_API_KEY);
  formData.append("upload", new Blob([fileBuffer]), zipFile);
  formData.append("build_file_size", fileBuffer.length.toString());

  const response = await fetch(uploadUrl, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Upload failed ${response.status}: ${text}`);
  }

  const result = await response.json();
  log(`✓ Uploaded successfully`);
  log(
    `Check your game: https://${ITCHIO_USERNAME}.itch.io/${ITCHIO_GAME_SLUG}`,
  );

  return result;
}

uploadToItchio().catch((e) => {
  log(`[ERROR] ${e.message}`);
  process.exit(1);
});
