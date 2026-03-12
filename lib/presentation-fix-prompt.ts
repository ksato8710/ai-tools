import type { PresentationData } from "./presentation-schema";
import type { CheckResult } from "./presentation-checker";

/**
 * Generate a fix prompt for a single slide issue.
 * Claude should return ONLY the fixed slide JSON object.
 */
export function generateFixPrompt(
  result: CheckResult,
  data: PresentationData,
  _sessionId: string
): string {
  const slide = data.slides[result.slideIndex];
  if (!slide) return "";

  const parts: string[] = [];

  parts.push(`## Issue`);
  parts.push(`- Check: ${result.checkId}`);
  parts.push(`- Severity: ${result.severity}`);
  parts.push(`- Slide #${result.slideIndex + 1} (id: ${result.slideId})`);
  parts.push(`- Message: ${result.message}`);
  if (result.detail) {
    parts.push(`- Detail: ${result.detail}`);
  }
  parts.push(``);

  parts.push(`## Fix Guidance`);
  parts.push(getFixGuidance(result));
  parts.push(``);

  parts.push(`## Current Slide JSON`);
  parts.push(JSON.stringify(slide, null, 2));
  parts.push(``);

  parts.push(`Return the fixed slide JSON object only.`);

  return parts.join("\n");
}

/**
 * Generate a bulk fix prompt for multiple issues.
 * Claude should return ONLY the fixed slides as a JSON array.
 */
export function generateBulkFixPrompt(
  results: CheckResult[],
  data: PresentationData,
  _sessionId: string
): string {
  const parts: string[] = [];

  parts.push(`## Issues to Fix (${results.length})`);
  parts.push(``);
  for (const r of results) {
    const slideLabel =
      r.slideIndex >= 0 ? `Slide #${r.slideIndex + 1}` : "Global";
    parts.push(`- [${r.severity.toUpperCase()}] ${slideLabel}: ${r.message}`);
    if (r.detail) parts.push(`  Detail: ${r.detail}`);
    parts.push(`  Guidance: ${getFixGuidance(r)}`);
    parts.push(``);
  }

  parts.push(`## Constraints`);
  parts.push(`- Keep slide IDs and section IDs unchanged`);
  parts.push(`- Maintain language (Japanese) and intent`);
  parts.push(`- For overflow: reduce items or shorten text (max 5 bullet items)`);
  parts.push(`- For text volume: condense to key phrases only`);
  parts.push(``);

  parts.push(`## Current Slides`);
  parts.push(JSON.stringify(data.slides, null, 2));
  parts.push(``);

  parts.push(`Return the fixed slides JSON array only.`);

  return parts.join("\n");
}

function getFixGuidance(result: CheckResult): string {
  switch (result.checkId) {
    case "overflow":
      return "Reduce the number of items, remove sub-items, shorten text, or split into multiple slides. For bullets, keep to 5 items max. For two-column, keep each column to 4-5 items.";
    case "text-volume":
      return "Condense text to key phrases. Remove explanatory text — the presenter will speak to it. Aim for < 250 chars per slide and < 6 bullet items.";
    case "contrast":
      return "Adjust colors in the designSystem to ensure sufficient contrast. Darken text or lighten background. WCAG AA requires 4.5:1 for normal text, 3:1 for large text.";
    case "empty":
      return "Add content to the empty field. Every slide should have a title and body content appropriate to its layout type.";
    case "consistency":
      return "Adjust slide layout or ordering to follow presentation best practices: title first, CTA last, section dividers between major sections.";
    case "structure":
      return "Ensure all slides are linked to outline sections. Update outline slideIds to include any orphaned slides.";
    default:
      return "Review and fix the issue.";
  }
}
