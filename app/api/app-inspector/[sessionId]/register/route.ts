import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { loadSession } from "@/lib/app-inspector-store";
import type { InspectorReport, CapturedScreen } from "@/lib/app-inspector-schema";

const COMPETITOR_UI_VIEWER_URL = process.env.COMPETITOR_UI_VIEWER_URL || "https://competitor-ui-viewer.craftgarden.studio";

/**
 * Build a display-friendly app name from report or package name.
 * e.g. "com.deepl.mobiletranslator" -> report description first sentence or "DeepL Mobiletranslator"
 */
function resolveAppName(sessionAppName: string, appPackage: string, report?: InspectorReport): string {
  // If session already has a human-readable name (not same as package), use it
  if (sessionAppName && sessionAppName !== appPackage) {
    return sessionAppName;
  }
  // Try to extract from report category (e.g. "ツール / 翻訳" -> not useful)
  // Use the last segment of package name, capitalized
  const lastSegment = appPackage.split(".").pop() || appPackage;
  const companySegment = appPackage.split(".").slice(-2, -1)[0] || "";
  const name = companySegment
    ? `${capitalize(companySegment)} ${capitalize(lastSegment)}`
    : capitalize(lastSegment);
  // If report has summary, the first noun phrase might be better
  if (report?.summary) {
    // Extract app name from summary - usually mentioned at the start
    const match = report.summary.match(/^(.+?)(?:は|とは|について)/);
    if (match && match[1].length <= 30) {
      return match[1].trim();
    }
  }
  return name;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Extract a flat list of feature names from featureAnalysis
 */
function extractFeatureNames(report: InspectorReport): string[] {
  if (!report.featureAnalysis) return [];
  const features: string[] = [];
  for (const category of report.featureAnalysis) {
    for (const f of category.features) {
      features.push(f.name);
    }
  }
  return features;
}

/**
 * Build unified screen list: merge report screenMap with actual captured screens.
 * Each screen gets the best available label + screenshot association.
 */
function buildScreenList(
  report: InspectorReport | undefined,
  capturedScreens: CapturedScreen[]
): { label: string; screenType: string; description: string; features: string[]; capturedScreen?: CapturedScreen }[] {
  if (!report?.screenMap || report.screenMap.length === 0) {
    // No report — use captured screens as-is
    return capturedScreens.map((cs) => ({
      label: cs.label,
      screenType: "unknown",
      description: "",
      features: [],
      capturedScreen: cs,
    }));
  }

  // Use report screenMap as the primary source (it has descriptive labels, features, descriptions).
  // Match captured screenshots by index: screenMap[i] ↔ capturedScreens[i]
  // (report's screenMap is generated from captured screens in the same order)
  return report.screenMap.map((sm, i) => ({
    label: sm.label,
    screenType: sm.screenType,
    description: sm.description,
    features: sm.features,
    capturedScreen: i < capturedScreens.length ? capturedScreens[i] : undefined,
  }));
}

// POST: Register session data to app-ui-ux-lab
export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const body = await request.json().catch(() => ({}));
  const session = await loadSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (!session.screens || session.screens.length === 0) {
    return NextResponse.json({ error: "No screens to register" }, { status: 400 });
  }

  try {
    const report = session.report;
    const appName = resolveAppName(session.appName, session.appPackage, report);
    const features = report ? extractFeatureNames(report) : [];
    const screens = buildScreenList(report, session.screens);

    // Derive company from package name (e.g. "com.deepl.mobiletranslator" -> "DeepL")
    const packageParts = session.appPackage.split(".");
    const companyRaw = packageParts.length >= 2 ? packageParts[packageParts.length - 2] : packageParts[0];

    const inspectionData: Record<string, unknown> = {
      app_package: session.appPackage,
      app_name: appName,
      platform: "Android",
      source_session_id: session.id,
      industry_id: body.industryId || null,
      category_id: body.categoryId || null,
      company: body.company || capitalize(companyRaw),
      company_en: capitalize(companyRaw),
    };

    if (report) {
      inspectionData.description = report.appOverview?.description;
      inspectionData.target_users = report.appOverview?.targetUsers;
      inspectionData.app_category = report.appOverview?.appCategory;
      inspectionData.navigation_pattern = report.appStructure?.navigationPattern;
      inspectionData.information_architecture = report.appStructure?.informationArchitecture;
      inspectionData.characteristics = report.characteristics;
      inspectionData.competitor_insights = report.competitorInsights;
      inspectionData.issues = report.issues;
      inspectionData.feature_analysis = report.featureAnalysis;
      inspectionData.screen_transitions = report.screenTransitions;
      inspectionData.key_flows = report.appStructure?.keyFlows;
      inspectionData.summary = report.summary;
      inspectionData.strengths = report.characteristics || [];
    }

    // Send screens based on actual captured screens (not report screenMap)
    inspectionData.screens = screens.map((s) => ({
      label: s.label,
      screen_type: s.screenType,
      description: s.description,
      features: s.features,
    }));

    // Also include features as top-level for Viewer display
    if (features.length > 0) {
      inspectionData.features = features;
    }

    // Send the full report as structured JSON for the Viewer's report display
    if (report) {
      inspectionData.report_json = report;
    }

    // Step 1: Register inspection data
    const registerRes = await fetch(`${COMPETITOR_UI_VIEWER_URL}/api/inspections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(inspectionData),
    });

    if (!registerRes.ok) {
      const err = await registerRes.json().catch(() => ({ error: "Registration failed" }));
      return NextResponse.json({ error: `Registration failed: ${err.error}` }, { status: 500 });
    }

    const { id: inspectionId } = await registerRes.json();

    // Step 2: Upload screenshots (using captured screen labels for matching)
    let uploadedCount = 0;
    const uploadErrors: string[] = [];
    for (const screen of screens) {
      const cs = screen.capturedScreen;
      if (!cs?.screenshotPath) {
        uploadErrors.push(`${screen.label}: screenshotPath が未設定`);
        continue;
      }

      try {
        const filePath = join(process.cwd(), "public", cs.screenshotPath.replace(/^\//, ""));
        const fileBuffer = await readFile(filePath);

        const formData = new FormData();
        formData.append("file", new Blob([fileBuffer], { type: "image/png" }), `${cs.id}.png`);
        formData.append("label", screen.label);

        const uploadRes = await fetch(
          `${COMPETITOR_UI_VIEWER_URL}/api/inspections/${inspectionId}/screenshots`,
          { method: "POST", body: formData }
        );

        if (uploadRes.ok) {
          uploadedCount++;
        } else {
          const respBody = await uploadRes.text().catch(() => "");
          uploadErrors.push(`${screen.label}: HTTP ${uploadRes.status} ${respBody.slice(0, 200)}`);
        }
      } catch (e) {
        uploadErrors.push(`${screen.label}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (uploadedCount === 0) {
      return NextResponse.json(
        {
          error: `スクリーンショットのアップロードに全件失敗しました（${session.screens.length}件）`,
          details: uploadErrors,
        },
        { status: 500 }
      );
    }

    // Build direct link to the app detail page
    const industryParam = body.industryId ? encodeURIComponent(body.industryId) : "other";
    const appDetailUrl = `${COMPETITOR_UI_VIEWER_URL}/?industry=${industryParam}&app=${encodeURIComponent(inspectionId)}`;

    return NextResponse.json({
      success: true,
      inspectionId,
      screensUploaded: uploadedCount,
      totalScreens: screens.length,
      viewerUrl: appDetailUrl,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Registration failed" },
      { status: 500 }
    );
  }
}
