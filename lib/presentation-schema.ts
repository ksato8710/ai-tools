// Presentation Schema - Contract between AI agents and the Viewer
// AI agents output this JSON format, the Viewer renders and allows interactive editing

export interface PresentationData {
  metadata: PresentationMetadata;
  outline: OutlineSection[];
  slides: Slide[];
  theme?: PresentationTheme;
  designSystem?: DesignSystem;
}

export interface PresentationMetadata {
  title: string;
  subtitle?: string;
  targetAudience: string;
  purpose: string;
  keyMessages: string[];
  author?: string;
  date?: string;
}

export interface OutlineSection {
  id: string;
  title: string;
  points: string[];
  slideIds: string[]; // links to which slides belong to this section
}

export interface Slide {
  id: string;
  sectionId: string;
  layout: SlideLayout;
  title: string;
  subtitle?: string;
  body?: SlideBody;
  notes?: string; // speaker notes
}

export type SlideLayout =
  | "title"
  | "section-divider"
  | "bullets"
  | "two-column"
  | "stats"
  | "quote"
  | "image-text"
  | "cta";

export type SlideBody =
  | BulletsBody
  | TwoColumnBody
  | StatsBody
  | QuoteBody
  | ImageTextBody
  | CtaBody
  | TitleBody;

export interface TitleBody {
  type: "title";
  tagline?: string;
  description?: string;
}

export interface BulletsBody {
  type: "bullets";
  items: BulletItem[];
}

export interface BulletItem {
  text: string;
  subItems?: string[];
}

export interface TwoColumnBody {
  type: "two-column";
  left: ColumnContent;
  right: ColumnContent;
}

export interface ColumnContent {
  heading?: string;
  items?: string[];
  description?: string;
}

export interface StatsBody {
  type: "stats";
  stats: StatItem[];
  footnote?: string;
}

export interface StatItem {
  value: string;
  label: string;
  description?: string;
}

export interface QuoteBody {
  type: "quote";
  quote: string;
  attribution?: string;
  context?: string;
}

export interface ImageTextBody {
  type: "image-text";
  imageUrl?: string;
  imagePlaceholder?: string;
  text: string;
  imagePosition?: "left" | "right";
}

export interface CtaBody {
  type: "cta";
  heading: string;
  description?: string;
  actions?: string[];
  contactInfo?: string;
}

// --- Legacy simple theme (backward compatible) ---
export interface PresentationTheme {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily?: string;
}

// Default theme
export const defaultTheme: PresentationTheme = {
  primaryColor: "#1a365d",
  secondaryColor: "#2b6cb0",
  accentColor: "#ed8936",
  backgroundColor: "#ffffff",
  textColor: "#1a202c",
};

// --- Design System (extended theme) ---
// AI agents or humans define this JSON to fully control slide appearance.

export interface DesignSystem {
  name: string;
  colors: DesignColors;
  typography: DesignTypography;
  radius: DesignRadius;
  spacing: DesignSpacing;
  decorations: DesignDecorations;
  shadows?: DesignShadows;
}

export interface DesignColors {
  primary: string;          // Main brand / heading color
  primaryDark: string;      // Dark variant (dark section bg, CTA bg)
  accent: string;           // Accent color (highlights, bullets, links)
  background: string;       // Page / slide background
  backgroundAlt: string;    // Alternate section background
  surface: string;          // Card / content surface
  text: string;             // Primary text
  textInverse: string;      // Text on dark backgrounds
  textMuted: string;        // Secondary / muted text
  error?: string;           // Error / validation
}

export interface DesignTypography {
  headingFont: string;      // Font family for headings (e.g. "Inter")
  bodyFont: string;         // Font family for body text
  // Font sizes in px
  heroSize: number;         // Title slide main text
  h1Size: number;           // Section heading
  h2Size: number;           // Slide title
  h3Size: number;           // Sub-heading / column heading
  bodySize: number;         // Body text
  smallSize: number;        // Captions, footnotes
  // Weights
  headingWeight: number;    // e.g. 300 for light, 700 for bold
  bodyWeight: number;       // e.g. 400
  boldWeight: number;       // e.g. 600
  // Line heights (multiplier)
  headingLineHeight: number; // e.g. 1.15
  bodyLineHeight: number;    // e.g. 1.6
  // Letter spacing in em
  headingLetterSpacing?: number; // e.g. -0.02
  bodyLetterSpacing?: number;    // e.g. 0.01
}

export interface DesignRadius {
  none: number;             // 0
  sm: number;               // e.g. 2 (tags, badges)
  md: number;               // e.g. 10 (cards, images)
  lg: number;               // e.g. 20 (large panels)
  full: number;             // 9999 (pills, circles)
}

export interface DesignSpacing {
  xs: number;               // e.g. 8
  sm: number;               // e.g. 16
  md: number;               // e.g. 24
  lg: number;               // e.g. 40
  xl: number;               // e.g. 64
  sectionPadding: number;   // e.g. 80
}

export interface DesignDecorations {
  accentBarHeight: number;      // px, e.g. 3
  accentBarWidth: number;       // px, e.g. 60
  bulletStyle: "dot" | "dash" | "circle" | "square";
  bulletSize: number;           // px, e.g. 6
  sectionDividerStyle: "bar" | "line" | "gradient" | "none";
  backgroundPattern?: "none" | "dots" | "grid" | "gradient";
  headerUnderline: boolean;     // Show accent line under slide titles
}

export interface DesignShadows {
  none: string;
  sm: string;               // e.g. "0 1px 3px rgba(0,0,0,0.1)"
  md: string;               // e.g. "0 4px 12px rgba(0,0,0,0.1)"
  lg: string;               // e.g. "0 8px 24px rgba(0,0,0,0.12)"
}

// --- Default design system ---
export const defaultDesignSystem: DesignSystem = {
  name: "Default",
  colors: {
    primary: "#1a365d",
    primaryDark: "#0f2440",
    accent: "#ed8936",
    background: "#ffffff",
    backgroundAlt: "#f7f7f5",
    surface: "#ffffff",
    text: "#1a202c",
    textInverse: "#ffffff",
    textMuted: "#718096",
  },
  typography: {
    headingFont: "Arial, sans-serif",
    bodyFont: "Arial, sans-serif",
    heroSize: 44,
    h1Size: 32,
    h2Size: 22,
    h3Size: 16,
    bodySize: 15,
    smallSize: 11,
    headingWeight: 700,
    bodyWeight: 400,
    boldWeight: 600,
    headingLineHeight: 1.15,
    bodyLineHeight: 1.6,
  },
  radius: { none: 0, sm: 2, md: 8, lg: 16, full: 9999 },
  spacing: { xs: 8, sm: 16, md: 24, lg: 40, xl: 64, sectionPadding: 80 },
  decorations: {
    accentBarHeight: 3,
    accentBarWidth: 64,
    bulletStyle: "dot",
    bulletSize: 8,
    sectionDividerStyle: "bar",
    headerUnderline: true,
  },
};

// Convert DesignSystem → legacy PresentationTheme (for backward compat)
export function designSystemToTheme(ds: DesignSystem): PresentationTheme {
  return {
    primaryColor: ds.colors.primary,
    secondaryColor: ds.colors.primaryDark,
    accentColor: ds.colors.accent,
    backgroundColor: ds.colors.background,
    textColor: ds.colors.text,
    fontFamily: ds.typography.headingFont,
  };
}
