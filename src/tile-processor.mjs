import Jimp from "jimp";

/**
 * Image pipeline (Jimp 0.22).
 *
 * Three things were wrong before:
 *  1. `new Jimp({width, height, color})` is the Jimp *v1* constructor. On 0.22
 *     it throws "No matching constructor overloading was found" as an
 *     *unhandled async error event*, so the surrounding try/catch never saw it
 *     and the whole process died on the first tileset.
 *  2. `image.write()` on 0.22 is not a promise, so `await`ing it did nothing
 *     and the next step could read a half-written file. `writeAsync` is.
 *  3. Nothing was ever resized. DALL-E returns 1024x1024, the docs promised
 *     256x256, and the preview grid composited 1024px tiles into a 768x256
 *     canvas.
 */

export const DEFAULT_TILE_SIZE = 512;

/**
 * Load a generated image and downscale it to the target tile size.
 */
async function loadTile(inputPath, tileSize) {
  const image = await Jimp.read(inputPath);
  if (image.bitmap.width !== tileSize || image.bitmap.height !== tileSize) {
    image.resize(tileSize, tileSize, Jimp.RESIZE_BICUBIC);
  }
  return image;
}

/**
 * Make a texture tile seamlessly.
 *
 * Uses the standard offset-and-heal method (the same idea as GIMP's "Make
 * Seamless"): wrap-offset the image by half its width and height, which makes
 * the outer edges continuous by construction — after the offset, the pixel at
 * column W-1 and the pixel at column 0 were neighbours in the original image —
 * and moves the discontinuity into an interior cross, which we then feather.
 *
 * The previous implementation cross-faded the two edge *bands* into each other
 * but left the actual wrap seam (column W-1 meeting column 0) untouched, so it
 * blurred the edges without making anything tile.
 */
export async function makeSeamless(
  inputPath,
  outputPath,
  tileSize = DEFAULT_TILE_SIZE,
) {
  const image = await loadTile(inputPath, tileSize);
  const { width, height } = image.bitmap;
  const src = Buffer.from(image.bitmap.data);
  const dst = image.bitmap.data;

  const halfW = Math.floor(width / 2);
  const halfH = Math.floor(height / 2);

  // 1. Wrap-offset by half.
  for (let y = 0; y < height; y++) {
    const sy = (y + halfH) % height;
    for (let x = 0; x < width; x++) {
      const sx = (x + halfW) % width;
      const di = (y * width + x) * 4;
      const si = (sy * width + sx) * 4;
      dst[di] = src[si];
      dst[di + 1] = src[si + 1];
      dst[di + 2] = src[si + 2];
      dst[di + 3] = src[si + 3];
    }
  }

  // 2. Feather the interior cross seam by cross-fading each pixel in the band
  //    with its reflection across the seam, weighted so the hard edge at the
  //    seam disappears and the effect falls off to nothing at the band edge.
  const band = Math.max(4, Math.floor(width * 0.08));
  featherVerticalSeam(dst, width, height, halfW, band);
  featherHorizontalSeam(dst, width, height, halfH, band);

  await image.writeAsync(outputPath);
  return outputPath;
}

function featherVerticalSeam(data, width, height, seamX, band) {
  for (let y = 0; y < height; y++) {
    for (let d = 0; d < band; d++) {
      // smoothstep: 1 at the seam, 0 at the band edge
      const t = d / band;
      const w = 0.5 * (1 - t) * (1 - t);

      blendPair(
        data,
        (y * width + wrap(seamX - 1 - d, width)) * 4,
        (y * width + wrap(seamX + d, width)) * 4,
        w,
      );
    }
  }
}

function featherHorizontalSeam(data, width, height, seamY, band) {
  for (let x = 0; x < width; x++) {
    for (let d = 0; d < band; d++) {
      const t = d / band;
      const w = 0.5 * (1 - t) * (1 - t);

      blendPair(
        data,
        (wrap(seamY - 1 - d, height) * width + x) * 4,
        (wrap(seamY + d, height) * width + x) * 4,
        w,
      );
    }
  }
}

/** Pull two pixels toward each other by weight w (0 = no change, 0.5 = equal). */
function blendPair(data, aIdx, bIdx, w) {
  for (let c = 0; c < 4; c++) {
    const a = data[aIdx + c];
    const b = data[bIdx + c];
    data[aIdx + c] = Math.round(a + (b - a) * w);
    data[bIdx + c] = Math.round(b + (a - b) * w);
  }
}

function wrap(v, n) {
  return ((v % n) + n) % n;
}

/**
 * Prepare a prop tile: downscale, then knock out the flat backdrop so the prop
 * drops onto a game map with transparency instead of a black square.
 *
 * Props are single centred objects, so the seamless pass is deliberately NOT
 * applied to them — the original code tiled them, which smeared the object
 * across its own edges.
 *
 * The knockout floods inward from the border rather than thresholding the
 * whole image, so dark pixels *inside* the prop survive.
 */
export async function prepareProp(
  inputPath,
  outputPath,
  tileSize = DEFAULT_TILE_SIZE,
  tolerance = 42,
) {
  const image = await loadTile(inputPath, tileSize);
  const { width, height, data } = image.bitmap;

  const visited = new Uint8Array(width * height);
  const stack = [];

  for (let x = 0; x < width; x++) {
    stack.push([x, 0], [x, height - 1]);
  }
  for (let y = 0; y < height; y++) {
    stack.push([0, y], [width - 1, y]);
  }

  const isBackdrop = (i) =>
    data[i] <= tolerance && data[i + 1] <= tolerance && data[i + 2] <= tolerance;

  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const p = y * width + x;
    if (visited[p]) continue;
    visited[p] = 1;

    const i = p * 4;
    if (!isBackdrop(i)) continue;

    data[i + 3] = 0;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  // Compression noise in the backdrop leaves isolated speckles the flood fill
  // won't cross. Clear any dark-ish pixel that is mostly surrounded by
  // transparency; interior detail has opaque neighbours and survives.
  despeckle(data, width, height, tolerance * 2);

  await image.writeAsync(outputPath);
  return outputPath;
}

function despeckle(data, width, height, tolerance) {
  const clear = [];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] === 0) continue;

      const luma = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (luma > tolerance) continue;

      let clearNeighbours = 0;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]) {
        if (data[((y + dy) * width + (x + dx)) * 4 + 3] === 0) clearNeighbours++;
      }

      if (clearNeighbours >= 5) clear.push(i);
    }
  }

  for (const i of clear) data[i + 3] = 0;
}

/**
 * Build a preview grid from the processed tiles.
 *
 * Floor and wall are shown as a 2x2 repeat so a buyer can see the tiling
 * actually works — which is the one thing a preview of a tileset needs to
 * prove.
 */
export async function createTilesetPreview(
  tileFiles,
  outputPath,
  tilesPerRow = 3,
  tileSize = DEFAULT_TILE_SIZE,
) {
  if (!tileFiles.length) throw new Error("No tiles provided");

  const cell = Math.floor(tileSize / 2) * 2;
  const rows = Math.ceil(tileFiles.length / tilesPerRow);
  const width = tilesPerRow * cell;
  const height = rows * cell;

  // Jimp 0.22 constructor: positional (w, h, colour), NOT an options object.
  const canvas = new Jimp(width, height, 0x141414ff);

  for (let i = 0; i < tileFiles.length; i++) {
    const { path, repeat = 1 } =
      typeof tileFiles[i] === "string" ? { path: tileFiles[i] } : tileFiles[i];

    const x = (i % tilesPerRow) * cell;
    const y = Math.floor(i / tilesPerRow) * cell;

    const tile = await Jimp.read(path);
    const sub = Math.floor(cell / repeat);
    tile.resize(sub, sub, Jimp.RESIZE_BICUBIC);

    for (let ry = 0; ry < repeat; ry++) {
      for (let rx = 0; rx < repeat; rx++) {
        canvas.composite(tile, x + rx * sub, y + ry * sub);
      }
    }
  }

  await canvas.writeAsync(outputPath);
  return outputPath;
}

/**
 * Generate a deterministic placeholder tile locally, so the whole pipeline can
 * be exercised in TEST_MODE without spending anything on the image API.
 */
export async function createPlaceholderTile(
  outputPath,
  seedText,
  kind = "floor",
  size = 1024,
) {
  let seed = 0;
  for (const ch of seedText) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;

  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };

  const base = [rand(), rand(), rand()].map((v) => 60 + Math.floor(v * 140));
  const image = new Jimp(size, size, 0x000000ff);
  const { data } = image.bitmap;

  // Props come back from the image model as a centred object on a flat black
  // backdrop, so the placeholder mimics that shape — otherwise the background
  // knockout has nothing to bite on and the test proves nothing.
  const centre = size / 2;
  const radius = size * 0.3;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;

      if (kind === "prop") {
        const dx = x - centre;
        const dy = y - centre;
        const wobble = 1 + Math.sin(Math.atan2(dy, dx) * 5 + (seed % 11)) * 0.12;
        if (Math.hypot(dx, dy) > radius * wobble) {
          data[i] = data[i + 1] = data[i + 2] = 0;
          data[i + 3] = 255;
          continue;
        }
      }

      const blotch =
        Math.sin(x / 37 + (seed % 13)) * 18 + Math.cos(y / 41 + (seed % 7)) * 18;
      const grain = (rand() - 0.5) * 26;
      data[i] = clamp(base[0] + blotch + grain);
      data[i + 1] = clamp(base[1] + blotch + grain);
      data[i + 2] = clamp(base[2] + blotch + grain);
      data[i + 3] = 255;
    }
  }

  await image.writeAsync(outputPath);
  return outputPath;
}

function clamp(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}
