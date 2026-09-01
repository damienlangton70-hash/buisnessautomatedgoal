import Jimp from "jimp";
import { readFile, writeFile } from "fs/promises";

export async function makeSeamless(inputPath, outputPath, tileSize = 256) {
  try {
    const image = await Jimp.read(inputPath);
    const width = image.bitmap.width || tileSize;
    const height = image.bitmap.height || tileSize;
    const blendWidth = Math.floor(width * 0.1);
    const blendHeight = Math.floor(height * 0.1);
    const pixels = image.bitmap.data;

    // Blend horizontal edges
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < blendWidth; x++) {
        const blendFactor = x / blendWidth;
        const leftIdx = (y * width + x) * 4;
        const rightIdx = (y * width + (width - blendWidth + x)) * 4;
        for (let c = 0; c < 4; c++) {
          const left = pixels[leftIdx + c];
          const right = pixels[rightIdx + c];
          const blended = Math.round(left * (1 - blendFactor) + right * blendFactor);
          pixels[leftIdx + c] = blended;
          pixels[rightIdx + c] = blended;
        }
      }
    }

    // Blend vertical edges
    for (let y = 0; y < blendHeight; y++) {
      for (let x = 0; x < width; x++) {
        const blendFactor = y / blendHeight;
        const topIdx = (y * width + x) * 4;
        const botIdx = ((height - blendHeight + y) * width + x) * 4;
        for (let c = 0; c < 4; c++) {
          const top = pixels[topIdx + c];
          const bot = pixels[botIdx + c];
          const blended = Math.round(top * (1 - blendFactor) + bot * blendFactor);
          pixels[topIdx + c] = blended;
          pixels[botIdx + c] = blended;
        }
      }
    }

    await image.write(outputPath);
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

    // Create dark canvas
    const canvas = new Jimp({ width, height, color: 0x141414ff });

    // Composite tiles onto canvas
    for (let i = 0; i < tileFiles.length; i++) {
      const row = Math.floor(i / tilesPerRow);
      const col = i % tilesPerRow;
      const x = col * tileSize;
      const y = row * tileSize;

      const tile = await Jimp.read(tileFiles[i]);
      canvas.composite(tile, x, y);
    }

    await canvas.write(outputPath);
    return outputPath;
  } catch (error) {
    console.error(`Failed to create preview ${outputPath}:`, error);
    throw error;
  }
}
