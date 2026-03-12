// Presentation Schema - Contract between AI agents and the Viewer
// AI agents output this JSON format, the Viewer renders and allows interactive editing

export interface PresentationData {
  metadata: PresentationMetadata;
  outline: OutlineSection[];
  slides: Slide[];
  theme?: PresentationTheme;
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
