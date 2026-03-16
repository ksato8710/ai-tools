import sharp from "sharp";
import Tesseract from "tesseract.js";

export interface PiiMaskConfig {
  /** Terms to detect and mask (e.g. ["山田太郎", "太郎", "yamadataro"]) */
  terms: string[];
  /** Blur strength (sigma). Default: 20 */
  blurSigma?: number;
  /** Extra padding around detected region (px). Default: 4 */
  padding?: number;
}

interface DetectedRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
}

/**
 * Detect PII text regions in an image using Tesseract OCR,
 * then blur matching regions using sharp.
 * Overwrites the file in-place.
 */
export async function maskPiiInImage(
  imagePath: string,
  config: PiiMaskConfig,
): Promise<{ masked: boolean; regionsFound: number }> {
  if (!config.terms.length) return { masked: false, regionsFound: 0 };

  const lowerTerms = config.terms.map((t) => t.toLowerCase());

  // Run OCR with Japanese + English
  const result = await Tesseract.recognize(imagePath, "jpn+eng", {
    logger: () => {}, // suppress progress logs
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = result.data as any;

  // Collect regions that match PII terms
  const regions: DetectedRegion[] = [];
  for (const word of (data.words || [])) {
    const text = word.text.trim();
    if (!text) continue;
    const lower = text.toLowerCase();
    const match = lowerTerms.some(
      (term) => lower.includes(term) || term.includes(lower),
    );
    if (match) {
      const bbox = word.bbox;
      regions.push({
        x: bbox.x0,
        y: bbox.y0,
        width: bbox.x1 - bbox.x0,
        height: bbox.y1 - bbox.y0,
        text,
      });
    }
  }

  // Also check lines — sometimes kanji names are split across words
  for (const line of (data.lines || [])) {
    const lineText = line.text.trim();
    if (!lineText) continue;
    const lineLower = lineText.toLowerCase();
    const match = lowerTerms.some((term) => lineLower.includes(term));
    if (match) {
      // Find which part of the line matches and add just that region
      // But for safety, check if we already have word-level matches covering this
      const bbox = line.bbox;
      const lineRegion = {
        x: bbox.x0,
        y: bbox.y0,
        width: bbox.x1 - bbox.x0,
        height: bbox.y1 - bbox.y0,
        text: lineText,
      };
      // Only add if no word-level region overlaps significantly
      const alreadyCovered = regions.some(
        (r) =>
          r.y >= lineRegion.y &&
          r.y + r.height <= lineRegion.y + lineRegion.height &&
          r.x >= lineRegion.x - 5 &&
          r.x + r.width <= lineRegion.x + lineRegion.width + 5,
      );
      if (!alreadyCovered) {
        regions.push(lineRegion);
      }
    }
  }

  if (regions.length === 0) return { masked: false, regionsFound: 0 };

  // Apply blur to each region
  const sigma = config.blurSigma ?? 20;
  const pad = config.padding ?? 4;

  const image = sharp(imagePath);
  const metadata = await image.metadata();
  const imgWidth = metadata.width || 0;
  const imgHeight = metadata.height || 0;

  // Build composite: extract each region, blur it, overlay back
  const composites: sharp.OverlayOptions[] = [];
  for (const region of regions) {
    const x = Math.max(0, region.x - pad);
    const y = Math.max(0, region.y - pad);
    const w = Math.min(region.width + pad * 2, imgWidth - x);
    const h = Math.min(region.height + pad * 2, imgHeight - y);
    if (w <= 0 || h <= 0) continue;

    const blurred = await sharp(imagePath)
      .extract({ left: x, top: y, width: w, height: h })
      .blur(sigma)
      .toBuffer();

    composites.push({ input: blurred, left: x, top: y });
  }

  if (composites.length === 0) return { masked: false, regionsFound: 0 };

  const output = await sharp(imagePath).composite(composites).toBuffer();
  await sharp(output).toFile(imagePath);

  return { masked: true, regionsFound: regions.length };
}
