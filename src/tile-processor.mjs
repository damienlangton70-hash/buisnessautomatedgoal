import sharp from "sharp";
import { readFile, writeFile } from "fs/promises";

export async function makeSeamless(inputPath, outputPath, tileSize = 256) {
  try {
    const inputBuffer = await readFile(inputPath);
    let image = sharp(inputBuffer);
    const metadata = await image.metadata();
    const width = metadata.width || tileSize;
    const height = metadata.height || tileSize;
    const blendWidth = Math.floor(width * 0.1);
    const blendHeight = Math.floor(height * 0.1);
    const rawImage = await image.raw().toBuffer({ resolveWithObject: true });
    const pixels = rawImage.data;
    const channels = rawImage.info.channels;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < blendWidth; x++) {
        const blendFactor = x / blendWidth;
        const leftIdx = (y * width + x) * channels;
        const rightIdx = (y * width + (width - blendWidth + x)) * channels;
        for (let c = 0; c < channels; c++) {
          const left = pixels[leftIdx + c];
          const right = pixels[rightIdx + c];
          const blended = Math.round(left * (1 - blendFactor) + right * blendFactor);
          pixels[leftIdx + c] = blended;
          pixels[rightIdx + c] = blended;
        }
      }
    }
    for (let y = 0; y < blendHeight; y++) {
      for (let x = 0; x < width; x++) {
        const blendFactor = y / blendHeight;
        const topIdx = (y * width + x) * channels;
        const botIdx = ((height - blendHeight + y) * width + x) * channels;
        for (let c = 0; c < channels; c++) {
          const top = pixels[topIdx + c];
          const bot = pixels[botIdx + c];
          const blended = Math.round(top * (1 - blendFactor) + bot * blendFactor);
          pixels[topIdx + c] = blended;
          pixels[botIdx + c] = blended;
        }
      }
    }
    await sharp(pixels, { raw: { width, height, channels } }).png().toFile(outputPath);
    return outputPath;
  } catch (error) {
    console.error(`Failed to process tile ${inputPath}:`, error);
    throw error;
  }
}

export async function createTilesetPreview(tileFiles, outputPath, tilesPerRow = 3, tileSize = 256) {
  try {
    if (tileFiles.length === 0) throw new Error("No tiles provided");
    const rows = Math.ceil(tileFiles.length / tilesPerRow);
    const width = tilesPerRow * tileSize;
    const height = rows * tileSize;
    const canvas = await sharp({
      create: { width, height, channels: 4, background: { r: 20, g: 20, b: 20, alpha: 1 } },
    }).png().toBuffer();
    let composite = sharp(canvas);
    const composites = [];
    for (let i = 0; i < tileFiles.length; i++) {
      const row = Math.floor(i / tilesPerRow);
      const col = i % tilesPerRow;
      composites.push({ input: tileFiles[i], left: col * tileSize, top: row * tileSize });
    }
    composite = composite.composite(composites);
    await composite.toFile(outputPath);
    return outputPath;
  } catch (error) {
    console.error(`Failed to create preview ${outputPath}:`, error);
    throw error;
  }
}
