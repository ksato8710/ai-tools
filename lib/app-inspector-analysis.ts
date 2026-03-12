/**
 * Structural analysis of captured app screens from snapshot trees.
 */

export interface ScreenAnalysis {
  screenIndex: number;
  label: string;
  screenType: ScreenType;
  isTargetApp: boolean;
  navigation: NavigationInfo;
  sections: SectionInfo[];
  elementBreakdown: { type: string; count: number }[];
  depth: number;
}

export interface AppStructureAnalysis {
  appPackage: string;
  appName: string;
  validScreenCount: number;
  totalScreenCount: number;
  screenTypes: { type: ScreenType; count: number }[];
  navigation: {
    pattern: string;
    tabs: string[];
    menuItems: string[];
  };
  sections: { name: string; screens: number[] }[];
  features: string[];
  screens: ScreenAnalysis[];
}

export type ScreenType =
  | "home"
  | "list"
  | "detail"
  | "form"
  | "settings"
  | "menu"
  | "notification"
  | "search"
  | "external"
  | "unknown";

interface NavigationInfo {
  tabs: { label: string; ref: string }[];
  buttons: { label: string; ref: string }[];
  hasBackButton: boolean;
  hasBottomNav: boolean;
}

interface SectionInfo {
  name: string;
  elementCount: number;
  type: "scroll-content" | "navigation" | "header" | "action-area" | "list" | "card-group";
}

interface ParsedElement {
  ref: string;
  type: string;
  label: string;
  depth: number;
  rawLine: string;
}

function parseTree(raw: string): { elements: ParsedElement[]; meta: Record<string, string> } {
  const meta: Record<string, string> = {};
  const elements: ParsedElement[] = [];

  for (const line of raw.split("\n")) {
    // Parse meta lines (Page:, App:, Snapshot:)
    const metaMatch = line.match(/^(Page|App|Snapshot):\s*(.+)/);
    if (metaMatch) {
      meta[metaMatch[1].toLowerCase()] = metaMatch[2].trim();
      continue;
    }

    // Parse element lines
    const match = line.match(/^(\s*)(@\w+)\s+\[([^\]]+)\]\s*"?([^"]*)"?/);
    if (match) {
      elements.push({
        ref: match[2],
        type: match[3].trim(),
        label: match[4].trim().replace(/&#10;/g, " "),
        depth: Math.floor(match[1].length / 2),
        rawLine: line,
      });
    }
  }

  return { elements, meta };
}

function isExternalScreen(raw: string): boolean {
  // Detect launcher/home screen
  return raw.includes("com.android.launcher3") ||
    raw.includes("com.google.android.apps.nexuslauncher") ||
    raw.includes("アプリのリスト") ||
    raw.includes("アプリを検索");
}

function classifyScreen(elements: ParsedElement[], label: string): ScreenType {
  const types = elements.map((e) => e.type.toLowerCase());
  const labels = elements.map((e) => e.label.toLowerCase()).filter(Boolean);

  // Form detection
  const hasTextField = types.some((t) => t === "text-field" || t === "textfield");
  const hasCheckbox = types.some((t) => t === "checkbox" || t === "switch");
  if (hasTextField && elements.length < 20) return "form";

  // Search screen
  if (hasTextField && labels.some((l) => l.includes("検索") || l.includes("search"))) return "search";

  // Settings
  if (labels.some((l) => l.includes("設定") || l.includes("setting"))) return "settings";

  // Notification / News
  if (labels.some((l) => l.includes("お知らせ") || l.includes("通知") || l.includes("notification"))) return "notification";

  // Menu
  if (labels.some((l) => l.includes("メニュー") || l.includes("menu"))) {
    const menuItemCount = elements.filter((e) =>
      e.type.toLowerCase() === "image" && e.label.length > 0
    ).length;
    if (menuItemCount > 3) return "menu";
  }

  // List screen (many similar repeated elements)
  const recyclerView = types.some((t) => t.includes("recyclerview"));
  if (recyclerView) return "list";

  // Home screen (has scroll area + multiple feature links + tabs)
  const hasScrollArea = types.some((t) => t === "scroll-area");
  const hasTab = elements.some((e) => e.label.includes("タブ") || e.type.toLowerCase() === "tab");
  const featureLinks = elements.filter((e) =>
    e.type.toLowerCase() === "image" && e.label.length > 0
  ).length;
  if (hasScrollArea && hasTab && featureLinks >= 3) return "home";

  // Detail (deep hierarchy, fewer interactive elements)
  const maxDepth = Math.max(...elements.map((e) => e.depth), 0);
  if (maxDepth > 5 && elements.length < 15) return "detail";

  return "unknown";
}

function extractNavigation(elements: ParsedElement[]): NavigationInfo {
  const tabs = elements
    .filter((e) => e.label.includes("タブ") || e.type.toLowerCase() === "tab")
    .map((e) => ({
      label: e.label.replace(/タブ:\s*\d+\/\d+/, "").trim() || e.label,
      ref: e.ref,
    }));

  const buttons = elements
    .filter((e) => {
      const t = e.type.toLowerCase();
      return (t === "button" || t === "image" || t === "link") && e.label.length > 0;
    })
    .map((e) => ({ label: e.label, ref: e.ref }));

  const hasBackButton = elements.some((e) =>
    e.label.includes("戻る") || e.label.toLowerCase().includes("back") || e.label.includes("navigate up")
  );

  const hasBottomNav = tabs.length > 0;

  return { tabs, buttons, hasBackButton, hasBottomNav };
}

function extractSections(elements: ParsedElement[]): SectionInfo[] {
  const sections: SectionInfo[] = [];

  // Find scroll areas as main content sections
  const scrollAreas = elements.filter((e) => e.type.toLowerCase() === "scroll-area");
  for (const sa of scrollAreas) {
    const children = elements.filter((e) => e.depth > sa.depth);
    const labeledChildren = children.filter((c) => c.label.length > 0);
    if (labeledChildren.length > 0) {
      sections.push({
        name: "メインコンテンツ",
        elementCount: children.length,
        type: "scroll-content",
      });
    }
  }

  // Find tab/navigation sections
  const tabElements = elements.filter((e) => e.label.includes("タブ"));
  if (tabElements.length > 0) {
    sections.push({
      name: "ボトムナビゲーション",
      elementCount: tabElements.length,
      type: "navigation",
    });
  }

  // Find feature groups (clusters of labeled images/buttons)
  const featureImages = elements.filter(
    (e) => e.type.toLowerCase() === "image" && e.label.length > 0
  );
  if (featureImages.length >= 3) {
    sections.push({
      name: "機能メニュー",
      elementCount: featureImages.length,
      type: "card-group",
    });
  }

  return sections;
}

function extractFeatures(elements: ParsedElement[]): string[] {
  const features: string[] = [];

  // Extract named features from labeled elements
  const featureLabels = elements
    .filter((e) => {
      const t = e.type.toLowerCase();
      return (t === "image" || t === "button" || t === "group") && e.label.length > 0;
    })
    .map((e) => e.label.replace(/&#10;/g, " ").trim())
    .filter((l) => l.length > 1 && l.length < 30);

  // Deduplicate
  const seen = new Set<string>();
  for (const label of featureLabels) {
    const normalized = label.replace(/\s+/g, " ");
    if (!seen.has(normalized)) {
      seen.add(normalized);
      features.push(normalized);
    }
  }

  return features;
}

export function analyzeScreen(
  raw: string,
  screenIndex: number,
  label: string,
  appPackage: string,
): ScreenAnalysis {
  const { elements } = parseTree(raw);
  const external = isExternalScreen(raw);
  const screenType = external ? "external" : classifyScreen(elements, label);
  const navigation = extractNavigation(elements);
  const sections = extractSections(elements);
  const maxDepth = Math.max(...elements.map((e) => e.depth), 0);

  // Element type breakdown
  const typeCounts = new Map<string, number>();
  for (const el of elements) {
    const t = el.type.toLowerCase();
    typeCounts.set(t, (typeCounts.get(t) || 0) + 1);
  }
  const elementBreakdown = Array.from(typeCounts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  return {
    screenIndex,
    label,
    screenType,
    isTargetApp: !external,
    navigation,
    sections,
    elementBreakdown,
    depth: maxDepth,
  };
}

export function analyzeApp(
  screens: { snapshotTree: string; label: string }[],
  appPackage: string,
  appName: string,
): AppStructureAnalysis {
  const screenAnalyses = screens.map((s, i) =>
    analyzeScreen(s.snapshotTree, i, s.label, appPackage)
  );

  const validScreens = screenAnalyses.filter((s) => s.isTargetApp);

  // Screen type summary
  const typeMap = new Map<ScreenType, number>();
  for (const s of validScreens) {
    typeMap.set(s.screenType, (typeMap.get(s.screenType) || 0) + 1);
  }
  const screenTypes = Array.from(typeMap.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  // Navigation pattern
  const allTabs = validScreens.flatMap((s) => s.navigation.tabs);
  const tabLabels = [...new Set(allTabs.map((t) => t.label))];
  const allButtons = validScreens.flatMap((s) => s.navigation.buttons);
  const menuItems = [...new Set(
    allButtons
      .map((b) => b.label)
      .filter((l) => l.length > 1 && l.length < 20)
  )];

  const hasBottomNav = validScreens.some((s) => s.navigation.hasBottomNav);
  const pattern = hasBottomNav
    ? tabLabels.length > 2
      ? "Tab Navigation (Bottom)"
      : "Simple Bottom Nav"
    : "Stack Navigation";

  // Features across all screens
  const allFeatures: string[] = [];
  const featureSeen = new Set<string>();
  for (const s of validScreens) {
    for (const section of s.sections) {
      if (section.type === "card-group" || section.type === "scroll-content") {
        // Get labeled elements from that screen's tree
        const { elements } = parseTree(screens[s.screenIndex].snapshotTree);
        for (const el of elements) {
          if (el.label.length > 1 && el.label.length < 30 && !featureSeen.has(el.label)) {
            featureSeen.add(el.label);
            allFeatures.push(el.label.replace(/&#10;/g, " "));
          }
        }
      }
    }
  }

  // Group screens by detected section
  const sectionScreenMap = new Map<string, number[]>();
  for (const s of validScreens) {
    for (const sec of s.sections) {
      if (!sectionScreenMap.has(sec.name)) {
        sectionScreenMap.set(sec.name, []);
      }
      sectionScreenMap.get(sec.name)!.push(s.screenIndex);
    }
  }
  const sections = Array.from(sectionScreenMap.entries()).map(([name, idxs]) => ({
    name,
    screens: idxs,
  }));

  return {
    appPackage,
    appName,
    validScreenCount: validScreens.length,
    totalScreenCount: screens.length,
    screenTypes,
    navigation: {
      pattern,
      tabs: tabLabels,
      menuItems: menuItems.slice(0, 20),
    },
    sections,
    features: allFeatures.slice(0, 30),
    screens: screenAnalyses,
  };
}

export const SCREEN_TYPE_LABELS: Record<ScreenType, { ja: string; icon: string }> = {
  home: { ja: "ホーム画面", icon: "🏠" },
  list: { ja: "リスト画面", icon: "📋" },
  detail: { ja: "詳細画面", icon: "📄" },
  form: { ja: "フォーム画面", icon: "📝" },
  settings: { ja: "設定画面", icon: "⚙️" },
  menu: { ja: "メニュー画面", icon: "☰" },
  notification: { ja: "お知らせ画面", icon: "🔔" },
  search: { ja: "検索画面", icon: "🔍" },
  external: { ja: "アプリ外", icon: "⚠️" },
  unknown: { ja: "不明", icon: "❓" },
};
