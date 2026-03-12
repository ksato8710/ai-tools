export interface AppInspectorSession {
  id: string;
  appPackage: string;
  appName: string;
  deviceName: string;
  createdAt: string;
  updatedAt: string;
  status: "capturing" | "completed" | "error";
  screens: CapturedScreen[];
  summary?: AnalysisSummary;
  error?: string;
  videoPath?: string; // path to capture recording (relative to public/)
  captureLog?: string[]; // log of actions taken during capture
}

export interface CapturedScreen {
  id: string;
  index: number;
  screenshotPath: string; // relative to public/
  snapshotTree: string; // accessibility tree text
  label: string; // auto-detected screen label
  interactiveElements: number;
  totalElements: number;
  timestamp: string;
  notes?: string;
}

export interface AnalysisSummary {
  totalScreens: number;
  uniqueScreens: number;
  avgInteractiveElements: number;
  navigationPattern: string;
  componentInventory: ComponentCount[];
  accessibilityScore?: number;
}

export interface ComponentCount {
  type: string; // button, textfield, image, etc.
  count: number;
}

export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createSession(
  appPackage: string,
  appName: string,
  deviceName: string
): AppInspectorSession {
  const now = new Date().toISOString();
  return {
    id: generateId("ai"),
    appPackage,
    appName,
    deviceName,
    createdAt: now,
    updatedAt: now,
    status: "capturing",
    screens: [],
  };
}
