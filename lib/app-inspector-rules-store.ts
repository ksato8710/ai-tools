/**
 * Learnable rule engine for app inspector analysis.
 * Rules are accumulated from LLM analysis results and used as fallback/supplement.
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";

const RULES_FILE = join(process.cwd(), "data", "app-inspector-rules.json");

export interface ScreenTypePattern {
  keywords: string[];
  elementTypes: string[];
  screenType: string;
  confidence: number;
  occurrences: number;
  lastSeen: string;
}

export interface NavigationPattern {
  pattern: string;
  description: string;
  indicators: string[];
  occurrences: number;
}

export interface LearnedRules {
  version: number;
  lastUpdated: string;
  totalAnalyses: number;
  screenTypePatterns: ScreenTypePattern[];
  navigationPatterns: NavigationPattern[];
  appProfiles: {
    appPackage: string;
    appName: string;
    lastAnalyzed: string;
    screenTypes: string[];
    features: string[];
  }[];
}

const DEFAULT_RULES: LearnedRules = {
  version: 1,
  lastUpdated: new Date().toISOString(),
  totalAnalyses: 0,
  screenTypePatterns: [],
  navigationPatterns: [],
  appProfiles: [],
};

export async function loadLearnedRules(): Promise<LearnedRules> {
  try {
    const data = await readFile(RULES_FILE, "utf-8");
    return JSON.parse(data) as LearnedRules;
  } catch {
    return { ...DEFAULT_RULES };
  }
}

async function saveLearnedRules(rules: LearnedRules): Promise<void> {
  await mkdir(join(process.cwd(), "data"), { recursive: true });
  await writeFile(RULES_FILE, JSON.stringify(rules, null, 2), "utf-8");
}

/**
 * Update learned rules from LLM analysis results.
 * This is the feedback loop: each LLM analysis improves the rules.
 */
export async function updateLearnedRules(
  rules: LearnedRules,
  llmResult: {
    screenClassifications?: {
      screenIndex: number;
      screenType: string;
      features: string[];
      confidence: number;
    }[];
    navigationPattern?: string;
    mainFeatures?: string[];
    appDescription?: string;
  },
  screens: { snapshotTree: string; label: string; index: number }[],
): Promise<void> {
  rules.totalAnalyses++;
  rules.lastUpdated = new Date().toISOString();

  // Extract screen type patterns from LLM classifications
  if (llmResult.screenClassifications) {
    for (const sc of llmResult.screenClassifications) {
      if (sc.confidence < 0.7) continue; // Only learn from high-confidence classifications

      const screen = screens.find((s) => s.index === sc.screenIndex);
      if (!screen?.snapshotTree) continue;

      // Extract significant keywords from the snapshot
      const keywords = extractSignificantKeywords(screen.snapshotTree);
      const elementTypes = extractElementTypes(screen.snapshotTree);

      if (keywords.length === 0) continue;

      // Find existing pattern or create new one
      const existing = rules.screenTypePatterns.find(
        (p) =>
          p.screenType === sc.screenType &&
          p.keywords.some((k) => keywords.includes(k))
      );

      if (existing) {
        existing.occurrences++;
        existing.confidence = Math.min(
          1.0,
          existing.confidence * 0.9 + sc.confidence * 0.1
        );
        existing.lastSeen = new Date().toISOString();
        // Merge new keywords
        for (const kw of keywords) {
          if (!existing.keywords.includes(kw)) {
            existing.keywords.push(kw);
          }
        }
        // Keep top 10 keywords by frequency
        if (existing.keywords.length > 10) {
          existing.keywords = existing.keywords.slice(0, 10);
        }
      } else {
        rules.screenTypePatterns.push({
          keywords: keywords.slice(0, 8),
          elementTypes: elementTypes.slice(0, 5),
          screenType: sc.screenType,
          confidence: sc.confidence,
          occurrences: 1,
          lastSeen: new Date().toISOString(),
        });
      }
    }
  }

  // Learn navigation patterns
  if (llmResult.navigationPattern) {
    const existing = rules.navigationPatterns.find(
      (p) => p.pattern === llmResult.navigationPattern
    );
    if (existing) {
      existing.occurrences++;
    } else {
      rules.navigationPatterns.push({
        pattern: llmResult.navigationPattern,
        description: llmResult.navigationPattern,
        indicators: [],
        occurrences: 1,
      });
    }
  }

  // Prune low-quality patterns (seen only once, older than 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  rules.screenTypePatterns = rules.screenTypePatterns.filter(
    (p) => p.occurrences > 1 || p.lastSeen > thirtyDaysAgo
  );

  // Keep top 50 patterns by occurrence count
  rules.screenTypePatterns.sort((a, b) => b.occurrences - a.occurrences);
  if (rules.screenTypePatterns.length > 50) {
    rules.screenTypePatterns = rules.screenTypePatterns.slice(0, 50);
  }

  await saveLearnedRules(rules);
}

/** Extract meaningful keywords from a snapshot tree */
function extractSignificantKeywords(snapshotTree: string): string[] {
  const keywords: string[] = [];
  const labelRegex = /"([^"]+)"/g;
  let match;

  while ((match = labelRegex.exec(snapshotTree)) !== null) {
    const label = match[1].trim();
    if (label.length >= 2 && label.length <= 20 && !label.match(/^[\d\s.,:;]+$/)) {
      keywords.push(label);
    }
  }

  // Deduplicate and take top keywords
  return [...new Set(keywords)].slice(0, 15);
}

/** Extract element types from a snapshot tree */
function extractElementTypes(snapshotTree: string): string[] {
  const types: string[] = [];
  const typeRegex = /\[([^\]]+)\]/g;
  let match;

  while ((match = typeRegex.exec(snapshotTree)) !== null) {
    types.push(match[1].trim().toLowerCase());
  }

  // Count and return most common types
  const counts = new Map<string, number>();
  for (const t of types) {
    counts.set(t, (counts.get(t) || 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([type]) => type)
    .slice(0, 8);
}
