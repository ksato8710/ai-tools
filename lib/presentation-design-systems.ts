import type { DesignSystem } from "./presentation-schema";

// Alceo Design System — extracted from https://alceo.simplex.inc/
export const alceoDesignSystem: DesignSystem = {
  name: "Alceo",
  colors: {
    primary: "#0E1410",       // Near-black dark green — primary text
    primaryDark: "#2B3D33",   // Dark green — dark section bg, footer, CTA
    accent: "#38B48B",        // Alceo green — brand accent
    background: "#F4F1EE",    // Warm off-white — page bg
    backgroundAlt: "#E1E4DD", // Green-gray — alternate section bg
    surface: "#FFFFFF",       // White — cards, inputs
    text: "#0E1410",          // Primary text
    textInverse: "#F4F1EE",   // Inverse text on dark bg
    textMuted: "#8F8F8F",     // Gray — muted labels, captions
    error: "#B43838",
  },
  typography: {
    headingFont: "'Inter', sans-serif",
    bodyFont: "'Inter', 'Hiragino Kaku Gothic ProN', sans-serif",
    heroSize: 47,       // 2.9375rem
    h1Size: 36,         // 2.25rem
    h2Size: 27,         // 1.6875rem
    h3Size: 20,         // 1.25rem
    bodySize: 15,       // 0.9375rem
    smallSize: 11,      // 0.6875rem
    headingWeight: 300, // Alceo uses light weight for English headings
    bodyWeight: 400,
    boldWeight: 600,
    headingLineHeight: 1.15,
    bodyLineHeight: 1.8, // Japanese body uses 180%
    headingLetterSpacing: -0.03,
    bodyLetterSpacing: 0.01,
  },
  radius: {
    none: 0,
    sm: 2,     // Tags
    md: 10,    // Cards, images (0.625rem)
    lg: 20,
    full: 9999, // Pill buttons
  },
  spacing: {
    xs: 10,     // 0.625rem
    sm: 20,     // 1.25rem
    md: 30,     // 1.875rem
    lg: 40,     // 2.5rem
    xl: 80,     // 5rem
    sectionPadding: 100, // 6.25rem
  },
  decorations: {
    accentBarHeight: 3,
    accentBarWidth: 48,   // Compact accent bar
    bulletStyle: "circle", // Alceo uses small accent circles
    bulletSize: 6,        // 0.375rem dots
    sectionDividerStyle: "bar",
    backgroundPattern: "none", // Alceo uses no patterns — depth via color alternation
    headerUnderline: true,
  },
  shadows: {
    none: "none",
    sm: "none", // Alceo uses no shadows
    md: "none",
    lg: "none",
  },
};

// Minimal corporate template
export const corporateDesignSystem: DesignSystem = {
  name: "Corporate",
  colors: {
    primary: "#1a365d",
    primaryDark: "#0f2440",
    accent: "#3182ce",
    background: "#ffffff",
    backgroundAlt: "#f7fafc",
    surface: "#ffffff",
    text: "#2d3748",
    textInverse: "#ffffff",
    textMuted: "#a0aec0",
  },
  typography: {
    headingFont: "'Arial', 'Helvetica Neue', sans-serif",
    bodyFont: "'Arial', 'Helvetica Neue', sans-serif",
    heroSize: 44,
    h1Size: 32,
    h2Size: 24,
    h3Size: 16,
    bodySize: 14,
    smallSize: 11,
    headingWeight: 700,
    bodyWeight: 400,
    boldWeight: 600,
    headingLineHeight: 1.2,
    bodyLineHeight: 1.6,
  },
  radius: { none: 0, sm: 2, md: 4, lg: 8, full: 9999 },
  spacing: { xs: 8, sm: 16, md: 24, lg: 40, xl: 64, sectionPadding: 80 },
  decorations: {
    accentBarHeight: 4,
    accentBarWidth: 80,
    bulletStyle: "dot",
    bulletSize: 8,
    sectionDividerStyle: "line",
    headerUnderline: true,
  },
};

// All built-in design systems
export const builtInDesignSystems: Record<string, DesignSystem> = {
  alceo: alceoDesignSystem,
  corporate: corporateDesignSystem,
};
