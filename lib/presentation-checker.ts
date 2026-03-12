import type {
  PresentationData,
  Slide,
  DesignSystem,
  defaultDesignSystem,
  BulletsBody,
  TwoColumnBody,
  StatsBody,
  QuoteBody,
  CtaBody,
  TitleBody,
} from "./presentation-schema";

// --- Check Result Types ---

export type CheckSeverity = "error" | "warning" | "info";

export interface CheckResult {
  checkId: string;
  slideId: string;
  slideIndex: number;
  severity: CheckSeverity;
  message: string;
  detail?: string;
}

export interface CheckCategory {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji-like short identifier
}

export interface CheckReport {
  timestamp: string;
  categories: CheckCategory[];
  results: CheckResult[];
  summary: {
    errors: number;
    warnings: number;
    infos: number;
    passed: number;
    total: number;
  };
}

// --- Check Categories ---

export const CHECK_CATEGORIES: CheckCategory[] = [
  {
    id: "overflow",
    name: "コンテンツ溢れ",
    description:
      "テキストやリスト項目がスライド領域からはみ出していないか",
    icon: "↕",
  },
  {
    id: "text-volume",
    name: "テキスト量",
    description: "1枚のスライドに情報を詰め込みすぎていないか",
    icon: "T",
  },
  {
    id: "contrast",
    name: "コントラスト",
    description: "テキストと背景のコントラスト比が十分か (WCAG AA)",
    icon: "◑",
  },
  {
    id: "empty",
    name: "空コンテンツ",
    description: "タイトルやbodyが空のスライドがないか",
    icon: "∅",
  },
  {
    id: "consistency",
    name: "一貫性",
    description: "レイアウトやフォントサイズの使い方に一貫性があるか",
    icon: "≡",
  },
  {
    id: "structure",
    name: "構造",
    description:
      "アウトラインとスライドの整合性、セクションのバランス",
    icon: "▦",
  },
];

// --- Main Check Runner ---

export function runAllChecks(
  data: PresentationData,
  ds?: DesignSystem
): CheckReport {
  const design: DesignSystem = ds || (data.designSystem as DesignSystem) || getDefaultDs();
  const results: CheckResult[] = [];

  for (let i = 0; i < data.slides.length; i++) {
    const slide = data.slides[i];
    results.push(...checkOverflow(slide, i, design));
    results.push(...checkTextVolume(slide, i));
    results.push(...checkContrast(slide, i, design));
    results.push(...checkEmpty(slide, i));
  }

  results.push(...checkConsistency(data));
  results.push(...checkStructure(data));

  const errors = results.filter((r) => r.severity === "error").length;
  const warnings = results.filter((r) => r.severity === "warning").length;
  const infos = results.filter((r) => r.severity === "info").length;
  const totalChecks =
    data.slides.length * 4 + 2; // 4 per-slide checks + 2 global
  const passed = totalChecks - (errors + warnings);

  return {
    timestamp: new Date().toISOString(),
    categories: CHECK_CATEGORIES,
    results,
    summary: {
      errors,
      warnings,
      infos,
      passed: Math.max(0, passed),
      total: totalChecks,
    },
  };
}

// --- Individual Check Functions ---

// 1. OVERFLOW CHECK
// Estimates content height vs available slide area (540px)
function checkOverflow(
  slide: Slide,
  index: number,
  ds: DesignSystem
): CheckResult[] {
  const results: CheckResult[] = [];
  const SLIDE_H = 540;
  const PADDING_Y = 96; // py-12 = 48px * 2
  const HEADER_H = 60; // title + subtitle + accent bar

  const available = SLIDE_H - PADDING_Y - HEADER_H;
  const ty = ds.typography;

  if (slide.layout === "bullets" && slide.body?.type === "bullets") {
    const body = slide.body as BulletsBody;
    let contentH = 0;
    const itemSpacing = ds.spacing.sm;

    for (const item of body.items) {
      // Main bullet line
      contentH += ty.h3Size * 1.4;
      // Sub items
      if (item.subItems) {
        contentH += item.subItems.length * (ty.bodySize - 1) * 1.5;
        contentH += 6; // mt-1.5
      }
      contentH += itemSpacing;
    }

    if (contentH > available) {
      results.push({
        checkId: "overflow",
        slideId: slide.id,
        slideIndex: index,
        severity: "error",
        message: `箇条書きが領域を超過しています（${body.items.length}項目）`,
        detail: `推定コンテンツ高: ${Math.round(contentH)}px / 利用可能: ${available}px。項目数を減らすか、サブ項目を削除してください。`,
      });
    } else if (contentH > available * 0.9) {
      results.push({
        checkId: "overflow",
        slideId: slide.id,
        slideIndex: index,
        severity: "warning",
        message: `箇条書きの余白が少なくなっています（${body.items.length}項目）`,
        detail: `推定コンテンツ高: ${Math.round(contentH)}px / 利用可能: ${available}px`,
      });
    }
  }

  if (slide.layout === "two-column" && slide.body?.type === "two-column") {
    const body = slide.body as TwoColumnBody;
    for (const [side, col] of [
      ["左", body.left],
      ["右", body.right],
    ] as const) {
      let contentH = 0;
      if (col.heading) contentH += ty.h3Size * 1.4 + 20;
      if (col.items) {
        contentH += col.items.length * ty.bodySize * 1.8;
      }
      if (col.description) {
        const lineCount = Math.ceil(col.description.length / 25); // ~25 chars per line
        contentH += lineCount * ty.bodySize * ty.bodyLineHeight;
      }
      if (contentH > available) {
        results.push({
          checkId: "overflow",
          slideId: slide.id,
          slideIndex: index,
          severity: "error",
          message: `${side}カラムが領域を超過しています`,
          detail: `推定: ${Math.round(contentH)}px / 利用可能: ${available}px`,
        });
      }
    }
  }

  if (slide.layout === "quote" && slide.body?.type === "quote") {
    const body = slide.body as QuoteBody;
    // Rough: each ~30 chars per line at h2Size
    const quoteLines = Math.ceil(body.quote.length / 30);
    const quoteH =
      quoteLines * ty.h2Size * 1.5 +
      (body.attribution ? 30 : 0) +
      (body.context ? 60 : 0) +
      80; // margins
    if (quoteH > SLIDE_H - 40) {
      results.push({
        checkId: "overflow",
        slideId: slide.id,
        slideIndex: index,
        severity: "warning",
        message: "引用テキストが長すぎる可能性があります",
        detail: `${body.quote.length}文字。30文字以下に短縮することを検討してください。`,
      });
    }
  }

  if (slide.layout === "cta" && slide.body?.type === "cta") {
    const body = slide.body as CtaBody;
    let contentH = 60; // title + heading
    contentH += ty.h1Size * 1.2;
    if (body.description) contentH += 60;
    if (body.actions) contentH += body.actions.length * 28;
    if (body.contactInfo) contentH += 40;
    if (contentH > SLIDE_H - 60) {
      results.push({
        checkId: "overflow",
        slideId: slide.id,
        slideIndex: index,
        severity: "warning",
        message: "CTAスライドのコンテンツ量が多い可能性があります",
      });
    }
  }

  if (slide.layout === "title" && slide.body?.type === "title") {
    const body = slide.body as TitleBody;
    let contentH = ty.heroSize * 1.2;
    if (slide.subtitle) contentH += ty.h2Size * 1.2 + 16;
    if (body.tagline) contentH += ty.bodySize * 1.4 + 32;
    if (body.description) {
      const lines = body.description.split("\n").length;
      contentH += lines * ty.bodySize * 1.6 + 24;
    }
    contentH += 40; // accent bar + margins
    if (contentH > SLIDE_H - 60) {
      results.push({
        checkId: "overflow",
        slideId: slide.id,
        slideIndex: index,
        severity: "warning",
        message: "タイトルスライドの情報量が多い可能性があります",
      });
    }
  }

  return results;
}

// 2. TEXT VOLUME CHECK
function checkTextVolume(slide: Slide, index: number): CheckResult[] {
  const results: CheckResult[] = [];

  // Count total characters in slide
  let totalChars = slide.title.length + (slide.subtitle?.length || 0);

  if (slide.body?.type === "bullets") {
    const body = slide.body as BulletsBody;
    for (const item of body.items) {
      totalChars += item.text.length;
      if (item.subItems) {
        totalChars += item.subItems.reduce((sum, s) => sum + s.length, 0);
      }
    }
    // Also check item count
    if (body.items.length > 6) {
      results.push({
        checkId: "text-volume",
        slideId: slide.id,
        slideIndex: index,
        severity: "error",
        message: `箇条書き項目が${body.items.length}個あります（推奨: 6個以下）`,
        detail:
          "1スライドの箇条書きは5〜6個以内が効果的です。スライドを分割することを検討してください。",
      });
    } else if (body.items.length > 4) {
      results.push({
        checkId: "text-volume",
        slideId: slide.id,
        slideIndex: index,
        severity: "info",
        message: `箇条書き${body.items.length}個: 情報量に注意`,
      });
    }
  }

  if (slide.body?.type === "two-column") {
    const body = slide.body as TwoColumnBody;
    for (const col of [body.left, body.right]) {
      totalChars += col.heading?.length || 0;
      if (col.items) totalChars += col.items.reduce((s, i) => s + i.length, 0);
      totalChars += col.description?.length || 0;
    }
  }

  if (slide.body?.type === "quote") {
    totalChars += (slide.body as QuoteBody).quote.length;
  }

  if (slide.body?.type === "cta") {
    const body = slide.body as CtaBody;
    totalChars += body.heading.length + (body.description?.length || 0);
  }

  // Total char thresholds
  if (totalChars > 400) {
    results.push({
      checkId: "text-volume",
      slideId: slide.id,
      slideIndex: index,
      severity: "error",
      message: `テキスト量が多すぎます（${totalChars}文字）`,
      detail:
        "プレゼンスライドは300文字以下が推奨です。キーメッセージに絞ってください。",
    });
  } else if (totalChars > 250) {
    results.push({
      checkId: "text-volume",
      slideId: slide.id,
      slideIndex: index,
      severity: "warning",
      message: `テキスト量がやや多めです（${totalChars}文字）`,
    });
  }

  return results;
}

// 3. CONTRAST CHECK
function checkContrast(
  slide: Slide,
  index: number,
  ds: DesignSystem
): CheckResult[] {
  const results: CheckResult[] = [];

  // Determine foreground/background for this slide layout
  let fg: string;
  let bg: string;

  if (slide.layout === "title" || slide.layout === "cta") {
    fg = ds.colors.textInverse;
    bg = ds.colors.primaryDark;
  } else if (slide.layout === "section-divider" || slide.layout === "quote") {
    fg = ds.colors.primary;
    bg = ds.colors.backgroundAlt;
  } else {
    fg = ds.colors.text;
    bg = ds.colors.background;
  }

  const ratio = contrastRatio(fg, bg);

  if (ratio < 3) {
    results.push({
      checkId: "contrast",
      slideId: slide.id,
      slideIndex: index,
      severity: "error",
      message: `コントラスト比が不十分です (${ratio.toFixed(1)}:1)`,
      detail: `WCAG AA基準は4.5:1以上（大きなテキストは3:1）。前景: ${fg}, 背景: ${bg}`,
    });
  } else if (ratio < 4.5) {
    results.push({
      checkId: "contrast",
      slideId: slide.id,
      slideIndex: index,
      severity: "warning",
      message: `コントラスト比がやや低めです (${ratio.toFixed(1)}:1)`,
      detail: `前景: ${fg}, 背景: ${bg}`,
    });
  }

  // Also check accent on background
  const accentRatio = contrastRatio(ds.colors.accent, bg);
  if (
    accentRatio < 3 &&
    slide.layout !== "title" &&
    slide.layout !== "cta"
  ) {
    results.push({
      checkId: "contrast",
      slideId: slide.id,
      slideIndex: index,
      severity: "info",
      message: `アクセントカラーの視認性が低い可能性 (${accentRatio.toFixed(1)}:1)`,
    });
  }

  return results;
}

// 4. EMPTY CONTENT CHECK
function checkEmpty(slide: Slide, index: number): CheckResult[] {
  const results: CheckResult[] = [];

  if (!slide.title.trim()) {
    results.push({
      checkId: "empty",
      slideId: slide.id,
      slideIndex: index,
      severity: "error",
      message: "タイトルが空です",
    });
  }

  if (
    !slide.body &&
    slide.layout !== "section-divider"
  ) {
    results.push({
      checkId: "empty",
      slideId: slide.id,
      slideIndex: index,
      severity: "warning",
      message: "コンテンツ (body) が未設定です",
    });
  }

  if (slide.body?.type === "bullets") {
    const body = slide.body as BulletsBody;
    if (body.items.length === 0) {
      results.push({
        checkId: "empty",
        slideId: slide.id,
        slideIndex: index,
        severity: "error",
        message: "箇条書き項目が0個です",
      });
    }
  }

  if (slide.body?.type === "stats") {
    const body = slide.body as StatsBody;
    if (body.stats.length === 0) {
      results.push({
        checkId: "empty",
        slideId: slide.id,
        slideIndex: index,
        severity: "error",
        message: "統計データが0個です",
      });
    }
  }

  return results;
}

// 5. CONSISTENCY CHECK (global)
function checkConsistency(data: PresentationData): CheckResult[] {
  const results: CheckResult[] = [];

  // Check if section dividers are used consistently
  const sections = data.outline;
  const sectionSlides = data.slides.filter(
    (s) => s.layout === "section-divider"
  );

  if (sections.length > 2 && sectionSlides.length === 0) {
    results.push({
      checkId: "consistency",
      slideId: "",
      slideIndex: -1,
      severity: "info",
      message: `${sections.length}セクションありますが、セクション区切りスライドがありません`,
      detail: "セクション区切りスライドを入れると、構造が明確になります。",
    });
  }

  // Check if first slide is title
  if (data.slides.length > 0 && data.slides[0].layout !== "title") {
    results.push({
      checkId: "consistency",
      slideId: data.slides[0].id,
      slideIndex: 0,
      severity: "info",
      message: "最初のスライドがタイトルスライドではありません",
    });
  }

  // Check if last slide is CTA or title
  if (data.slides.length > 1) {
    const last = data.slides[data.slides.length - 1];
    if (last.layout !== "cta" && last.layout !== "title") {
      results.push({
        checkId: "consistency",
        slideId: last.id,
        slideIndex: data.slides.length - 1,
        severity: "info",
        message: "最後のスライドがCTAまたはまとめスライドではありません",
      });
    }
  }

  return results;
}

// 6. STRUCTURE CHECK (global)
function checkStructure(data: PresentationData): CheckResult[] {
  const results: CheckResult[] = [];

  // Check outline-slide linkage
  for (const section of data.outline) {
    const linkedSlides = section.slideIds.filter((id) =>
      data.slides.some((s) => s.id === id)
    );
    if (linkedSlides.length === 0) {
      results.push({
        checkId: "structure",
        slideId: "",
        slideIndex: -1,
        severity: "warning",
        message: `セクション「${section.title}」に紐づくスライドがありません`,
      });
    }
  }

  // Orphan slides (not in any section)
  const allLinkedIds = new Set(data.outline.flatMap((s) => s.slideIds));
  for (let i = 0; i < data.slides.length; i++) {
    const slide = data.slides[i];
    if (!allLinkedIds.has(slide.id)) {
      results.push({
        checkId: "structure",
        slideId: slide.id,
        slideIndex: i,
        severity: "info",
        message: `スライド「${slide.title}」がアウトラインのどのセクションにも属していません`,
      });
    }
  }

  // Total slide count
  if (data.slides.length > 15) {
    results.push({
      checkId: "structure",
      slideId: "",
      slideIndex: -1,
      severity: "warning",
      message: `スライド数が${data.slides.length}枚です（推奨: 15枚以下）`,
      detail: "プレゼンの集中力は15分程度。1枚1分として15枚が目安です。",
    });
  }

  if (data.slides.length < 3) {
    results.push({
      checkId: "structure",
      slideId: "",
      slideIndex: -1,
      severity: "info",
      message: `スライド数が${data.slides.length}枚です。内容は十分ですか？`,
    });
  }

  return results;
}

// --- Utility: Contrast Ratio Calculation ---

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const num = parseInt(h.length === 3
    ? h.split("").map(c => c + c).join("")
    : h, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function relativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(hexToRgb(fg));
  const l2 = relativeLuminance(hexToRgb(bg));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function getDefaultDs(): DesignSystem {
  return {
    name: "Default",
    colors: {
      primary: "#1a365d", primaryDark: "#0f2440", accent: "#ed8936",
      background: "#ffffff", backgroundAlt: "#f7f7f5", surface: "#ffffff",
      text: "#1a202c", textInverse: "#ffffff", textMuted: "#718096",
    },
    typography: {
      headingFont: "Arial", bodyFont: "Arial",
      heroSize: 44, h1Size: 32, h2Size: 22, h3Size: 16,
      bodySize: 15, smallSize: 11,
      headingWeight: 700, bodyWeight: 400, boldWeight: 600,
      headingLineHeight: 1.15, bodyLineHeight: 1.6,
    },
    radius: { none: 0, sm: 2, md: 8, lg: 16, full: 9999 },
    spacing: { xs: 8, sm: 16, md: 24, lg: 40, xl: 64, sectionPadding: 80 },
    decorations: {
      accentBarHeight: 3, accentBarWidth: 64,
      bulletStyle: "dot", bulletSize: 8,
      sectionDividerStyle: "bar", headerUnderline: true,
    },
  };
}
