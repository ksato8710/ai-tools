/**
 * LLM-based analysis of captured app screens using Claude Code CLI (Opus).
 * Runs `claude -p` as a subprocess to leverage the user's Claude subscription.
 */

import { spawn } from "child_process";
import { appendFile } from "fs/promises";
import type { ScreenType, ScreenAnalysis, AppStructureAnalysis } from "./app-inspector-analysis";
import { loadLearnedRules, updateLearnedRules, type LearnedRules } from "./app-inspector-rules-store";
import type { InspectorReport } from "./app-inspector-schema";

type ProgressCallback = (message: string) => void;

/**
 * Call Claude Code CLI with Opus model using stream-json for progress tracking.
 * Uses the user's subscription — no API key needed.
 *
 * @param logFile - If provided, writes Opus's full response and events to this file
 */
async function callClaudeCode(
  prompt: string,
  systemPrompt?: string,
  onProgress?: ProgressCallback,
  logFile?: string,
): Promise<string> {
  // Use stdin for prompt delivery to avoid argument length limits
  // (snapshot trees can be very large)
  const args = ["-p", "--model", "opus", "--output-format", "stream-json", "--verbose"];
  if (systemPrompt) {
    args.push("--system-prompt", systemPrompt);
  }

  const env = { ...process.env, CLAUDECODE: undefined };

  const writeLog = (msg: string) => {
    if (logFile) appendFile(logFile, msg + "\n").catch(() => {});
  };

  return new Promise<string>((resolve, reject) => {
    const proc = spawn("claude", args, {
      env,
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 300_000, // 5 min
    });

    // Write prompt to stdin and close it.
    // Use end(data) to handle large prompts atomically (avoids backpressure issues).
    proc.stdin.end(prompt);

    let resultText = "";
    let buffer = "";
    let outputTokens = 0;
    let lastSnippet = "";
    let modelName = "claude-opus-4-6";
    let phase: "starting" | "thinking" | "generating" | "done" = "starting";
    const startTime = Date.now();

    writeLog(`\n--- Opus Call Start: ${new Date().toISOString()} ---`);
    writeLog(`[prompt-length] ${prompt.length} chars`);

    onProgress?.("Claude Code を起動中...");

    // Heartbeat: emit elapsed time every 5 seconds
    const heartbeat = setInterval(() => {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      if (phase === "thinking") {
        const snippet = lastSnippet ? ` | ${lastSnippet}` : "";
        onProgress?.(`${modelName} が思考中… (${elapsed}秒)${snippet}`);
      } else if (phase === "generating") {
        const snippet = lastSnippet ? ` | ${lastSnippet}` : "";
        onProgress?.(`${modelName} が生成中… (${elapsed}秒, ${outputTokens} tokens)${snippet}`);
      } else if (phase === "starting") {
        onProgress?.(`${modelName} に送信中… (${elapsed}秒経過)`);
      }
    }, 5000);

    proc.stdout.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);

          if (event.type === "system" && event.subtype === "init") {
            modelName = event.model || "claude-opus-4-6";
            const elapsed = Math.round((Date.now() - startTime) / 1000);
            onProgress?.(`Claude Code 起動完了 (pid: ${proc.pid})`);
            // Small delay then show model
            setTimeout(() => onProgress?.(`モデル: ${modelName}`), 100);
            writeLog(`[init] model=${modelName}, session=${event.session_id || ""}`);
          } else if (event.type === "assistant" && event.message?.content) {
            const usage = event.message.usage;
            if (usage?.output_tokens) {
              outputTokens = usage.output_tokens;
            }
            const content = event.message.content as { type: string; text?: string; thinking?: string }[];
            for (const block of content) {
              if (block.type === "thinking" && block.thinking) {
                phase = "thinking";
                const preview = block.thinking.slice(0, 120) + (block.thinking.length > 120 ? "…" : "");
                lastSnippet = preview;
                writeLog(`[thinking] ${block.thinking.slice(0, 500)}`);
              } else if (block.type === "text" && block.text) {
                phase = "generating";
                writeLog(`[opus-response]\n${block.text}`);
                const snippet = extractSnippet(block.text);
                if (snippet) lastSnippet = snippet;
              }
            }
            const elapsed = Math.round((Date.now() - startTime) / 1000);
            const snippet = lastSnippet ? ` | ${lastSnippet}` : "";
            if (phase === "thinking") {
              onProgress?.(`${modelName} が思考中… (${elapsed}秒)${snippet}`);
            } else {
              onProgress?.(`${modelName} が生成中… (${elapsed}秒, ${outputTokens} tokens)${snippet}`);
            }
          } else if (event.type === "result") {
            phase = "done";
            resultText = event.result || "";
            if (event.is_error) {
              writeLog(`[error] ${resultText}`);
              reject(new Error(`Claude Code error: ${resultText}`));
            }
            const elapsed = Math.round((Date.now() - startTime) / 1000);
            const cost = event.total_cost_usd ? `$${event.total_cost_usd.toFixed(3)}` : "";
            onProgress?.(`${modelName} 応答完了 (${elapsed}秒${cost ? `, ${cost}` : ""})`);
            writeLog(`[result] ${elapsed}s, ${outputTokens} tokens${cost ? `, ${cost}` : ""}`);
            writeLog(`--- Opus Call End ---\n`);
          }
        } catch { /* skip malformed lines */ }
      }
    });

    proc.stderr.on("data", () => { /* ignore stderr */ });

    proc.on("close", (code) => {
      clearInterval(heartbeat);
      if (code !== 0 && !resultText) {
        writeLog(`[exit] code=${code}`);
        reject(new Error(`Claude Code exited with code ${code}`));
      } else {
        resolve(resultText);
      }
    });

    proc.on("error", (err) => {
      clearInterval(heartbeat);
      writeLog(`[spawn-error] ${err.message}`);
      reject(err);
    });

    // Kill after 5 minutes
    setTimeout(() => {
      clearInterval(heartbeat);
      proc.kill("SIGTERM");
      writeLog(`[timeout] Killed after 5 minutes`);
      reject(new Error("Claude Code timed out (5 min)"));
    }, 5 * 60 * 1000);
  });
}

/** Extract a short readable snippet from LLM output for UI display */
function extractSnippet(text: string): string {
  // Skip pure JSON content, find last natural language line
  const lines = text.split("\n").filter((l) => l.trim());
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    // Skip JSON-looking lines, braces, keys
    if (/^[\[{}\]]$/.test(line)) continue;
    if (/^"[^"]+"\s*:/.test(line)) continue;
    // Found a readable line — truncate for display
    if (line.length > 60) return line.slice(0, 57) + "…";
    return line;
  }
  return "";
}

interface LLMScreenResult {
  screenIndex: number;
  label: string;
  screenType: ScreenType;
  isTargetApp: boolean;
  description: string;
  features: string[];
  navigationElements: string[];
  sections: { name: string; type: string; description: string }[];
  confidence: number;
}

interface LLMFeatureItem {
  name: string;
  description: string;
  screenType: string;
}

interface LLMFeatureCategory {
  category: string;
  features: LLMFeatureItem[];
}

interface LLMAppResult {
  appPackage: string;
  appName: string;
  appDescription: string;
  navigationPattern: string;
  mainFeatures: string[];
  screenClassifications: LLMScreenResult[];
  uxInsights: string[];
  competitorNotes: string[];
  featureList: LLMFeatureCategory[];
}

function buildSystemPrompt(learnedRules: LearnedRules): string {
  let rulesContext = "";
  if (learnedRules.screenTypePatterns.length > 0) {
    rulesContext += "\n\n## 学習済みパターン（過去の分析から蓄積）\n";
    rulesContext += "以下のパターンは過去の分析で確認されたものです。参考にしてください：\n";
    for (const pattern of learnedRules.screenTypePatterns) {
      rulesContext += `- 「${pattern.keywords.join("」「")}」→ ${pattern.screenType}（確信度: ${pattern.confidence}、${pattern.occurrences}回出現）\n`;
    }
  }
  if (learnedRules.navigationPatterns.length > 0) {
    rulesContext += "\n## 学習済みナビゲーションパターン\n";
    for (const p of learnedRules.navigationPatterns) {
      rulesContext += `- ${p.pattern}: ${p.description}\n`;
    }
  }

  return `あなたはAndroidアプリのUI構造分析の専門家です。
アクセシビリティスナップショットツリー（UIの階層構造テキスト）を分析し、
アプリの画面構成、ナビゲーション、機能を正確に分類してください。

## スナップショットツリーのフォーマット
- 各行: インデント + @ref [要素タイプ] "ラベル"
- インデントの深さ = UI階層の深さ
- 要素タイプ: Button, Image, StaticText, TextField, ScrollArea, Tab, etc.
- ラベル: ユーザーに表示されるテキスト

## 画面タイプの分類基準
- home: アプリのメイン画面。複数の機能へのリンク、ニュースフィード、タブナビゲーションなど
- list: 繰り返し要素のリスト表示（一覧画面）
- detail: 単一コンテンツの詳細表示
- form: ユーザー入力フォーム（テキストフィールド、チェックボックスなど）
- settings: 設定・環境設定画面
- menu: メニュー/ナビゲーションドロワー
- notification: お知らせ・通知一覧（※ホーム画面に「お知らせ」セクションがあってもhome扱い）
- search: 検索画面
- external: 対象アプリ外の画面（ランチャー、別アプリなど）
- unknown: 分類困難

## 重要な注意点
- ホーム画面に「お知らせ」セクションがある場合、notificationではなくhomeに分類する
- 画面全体の構造を見て判断する。特定キーワードだけで判断しない
- com.android.launcher3 や「アプリのリスト」を含む場合は external
${rulesContext}

## 出力形式
必ず以下のJSON形式で出力してください。他のテキストは含めないでください。`;
}

function buildAnalysisPrompt(
  screens: { snapshotTree: string; label: string; index: number }[],
  appPackage: string,
  appName: string,
): string {
  const screensText = screens
    .map((s, i) => `--- Screen ${i + 1} (index: ${s.index}, label: "${s.label}") ---\n${s.snapshotTree || "(スナップショットなし)"}`)
    .join("\n\n");

  return `以下のアプリのUI構造を分析してください。

アプリ: ${appName} (${appPackage})
画面数: ${screens.length}

${screensText}

以下のJSON形式で回答してください：
{
  "appDescription": "アプリの概要説明（日本語）",
  "navigationPattern": "Tab Navigation (Bottom) | Drawer Navigation | Stack Navigation | Simple",
  "mainFeatures": ["機能1", "機能2", ...],
  "screenClassifications": [
    {
      "screenIndex": 0,
      "label": "画面ラベル",
      "screenType": "home|list|detail|form|settings|menu|notification|search|external|unknown",
      "isTargetApp": true,
      "description": "この画面の説明",
      "features": ["この画面で提供される機能"],
      "navigationElements": ["ナビゲーション要素"],
      "sections": [{"name": "セクション名", "type": "scroll-content|navigation|header|action-area|list|card-group", "description": "説明"}],
      "confidence": 0.9
    }
  ],
  "uxInsights": ["UXに関する所見"],
  "competitorNotes": ["競合分析に有用な特徴"],
  "featureList": [
    {
      "category": "カテゴリ名",
      "features": [
        {
          "name": "機能名",
          "description": "この機能の説明",
          "screenType": "list|detail|form|etc"
        }
      ]
    }
  ]
}

featureList: アプリが提供するすべての機能を、カテゴリごとに整理してリストアップしてください。スナップショットツリーのラベル・ボタン・メニュー項目から機能を網羅的に抽出してください。`;
}

export async function analyzWithLLM(
  screens: { snapshotTree: string; label: string; index: number }[],
  appPackage: string,
  appName: string,
): Promise<AppStructureAnalysis | null> {
  return analyzeWithLLMStreaming(screens, appPackage, appName);
}

/**
 * LLM analysis with progress callbacks for streaming UI.
 */
export async function analyzeWithLLMStreaming(
  screens: { snapshotTree: string; label: string; index: number }[],
  appPackage: string,
  appName: string,
  onProgress?: (phase: string, message: string) => void,
  logFile?: string,
): Promise<AppStructureAnalysis | null> {
  const progress = onProgress || (() => {});

  progress("rules", "学習済みルールを読み込み中...");
  const learnedRules = await loadLearnedRules();
  progress("rules", `学習済みルール読み込み完了（${learnedRules.screenTypePatterns.length}パターン）`);

  try {
    progress("prepare", `${screens.length}画面のスナップショットデータを準備中...`);

    const systemPrompt = buildSystemPrompt(learnedRules);
    const userPrompt = buildAnalysisPrompt(screens, appPackage, appName);

    progress("llm", "Claude Code (Opus) で分析中...");

    const text = await callClaudeCode(userPrompt, systemPrompt, (msg) => {
      progress("llm", msg);
    }, logFile);

    progress("parse", "LLMレスポンスを解析中...");

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("[LLM Analysis] No JSON found in response");
      progress("error", "LLMレスポンスからJSONを抽出できませんでした");
      return null;
    }

    const llmResult: LLMAppResult = JSON.parse(jsonMatch[0]);

    progress("convert", `${llmResult.screenClassifications?.length || 0}画面の分類結果を変換中...`);

    // Convert LLM result to AppStructureAnalysis format
    const analysis = convertLLMResult(llmResult, screens, appPackage, appName);

    // Feedback loop: update learned rules based on LLM results
    progress("feedback", "学習ルールを更新中...");
    await updateLearnedRules(learnedRules, llmResult, screens);

    progress("complete", "分析完了");
    return analysis;
  } catch (err) {
    console.error("[LLM Analysis] Error:", err);
    progress("error", `LLM分析エラー: ${err instanceof Error ? err.message : "Unknown"}`);
    return null;
  }
}

function convertLLMResult(
  llmResult: LLMAppResult,
  screens: { snapshotTree: string; label: string; index: number }[],
  appPackage: string,
  appName: string,
): AppStructureAnalysis {
  const screenAnalyses: ScreenAnalysis[] = (llmResult.screenClassifications || []).map((sc) => {
    return {
      screenIndex: sc.screenIndex,
      label: sc.label || `Screen ${sc.screenIndex + 1}`,
      screenType: sc.screenType as ScreenType,
      isTargetApp: sc.isTargetApp !== false,
      navigation: {
        tabs: sc.navigationElements
          ?.filter((n) => n.includes("タブ") || n.includes("tab"))
          .map((n) => ({ label: n, ref: "" })) || [],
        buttons: sc.navigationElements
          ?.filter((n) => !n.includes("タブ") && !n.includes("tab"))
          .map((n) => ({ label: n, ref: "" })) || [],
        hasBackButton: sc.navigationElements?.some((n) =>
          n.includes("戻る") || n.toLowerCase().includes("back")
        ) || false,
        hasBottomNav: sc.navigationElements?.some((n) =>
          n.includes("タブ") || n.includes("tab") || n.includes("ナビ")
        ) || false,
      },
      sections: (sc.sections || []).map((s) => ({
        name: s.name,
        elementCount: 0,
        type: s.type as "scroll-content" | "navigation" | "header" | "action-area" | "list" | "card-group",
      })),
      elementBreakdown: [],
      depth: 0,
      description: sc.description,
    } as ScreenAnalysis & { description?: string };
  });

  // Fill in any missing screens
  for (let i = 0; i < screens.length; i++) {
    if (!screenAnalyses.find((s) => s.screenIndex === i)) {
      screenAnalyses.push({
        screenIndex: i,
        label: screens[i].label || `Screen ${i + 1}`,
        screenType: "unknown",
        isTargetApp: true,
        navigation: { tabs: [], buttons: [], hasBackButton: false, hasBottomNav: false },
        sections: [],
        elementBreakdown: [],
        depth: 0,
      });
    }
  }

  screenAnalyses.sort((a, b) => a.screenIndex - b.screenIndex);

  const validScreens = screenAnalyses.filter((s) => s.isTargetApp);
  const typeMap = new Map<ScreenType, number>();
  for (const s of validScreens) {
    typeMap.set(s.screenType, (typeMap.get(s.screenType) || 0) + 1);
  }

  // Extract tabs from all screens
  const allTabs = new Set<string>();
  for (const s of screenAnalyses) {
    for (const t of s.navigation.tabs) {
      allTabs.add(t.label);
    }
  }

  return {
    appPackage,
    appName,
    validScreenCount: validScreens.length,
    totalScreenCount: screens.length,
    screenTypes: Array.from(typeMap.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
    navigation: {
      pattern: llmResult.navigationPattern || "Simple",
      tabs: Array.from(allTabs),
      menuItems: llmResult.mainFeatures?.slice(0, 20) || [],
    },
    sections: [],
    features: llmResult.mainFeatures || [],
    screens: screenAnalyses,
    // Extended fields from LLM
    llmEnhanced: true,
    appDescription: llmResult.appDescription,
    uxInsights: llmResult.uxInsights,
    competitorNotes: llmResult.competitorNotes,
    featureList: llmResult.featureList || [],
  } as AppStructureAnalysis & {
    llmEnhanced: boolean;
    appDescription: string;
    uxInsights: string[];
    competitorNotes: string[];
    featureList: LLMFeatureCategory[];
  };
}

// ─── Iterative Capture Analysis ────────────────────────────────────────────

export interface UncapturedTarget {
  featureName: string;       // e.g. "ごみ出しカレンダー"
  navigationHint: string;    // e.g. "ホーム画面の「ごみ出しカレンダー」アイコンをタップ"
  targetLabel: string;       // スナップショットツリー内のラベル（pressElementで使う）
  fromScreen: string;        // "home" | "menu" | screen label
  priority: number;          // 1-10, 10=most important
}

export interface IterativeAnalysisResult {
  coveredFeatures: string[];       // キャプチャ済みの機能名リスト
  uncapturedTargets: UncapturedTarget[];  // 未キャプチャターゲット
  newDiscoveries: string[];        // 今回新しく発見した機能・導線
  isComplete: boolean;             // すべてカバーしたかどうか
  summary: string;                 // 現在の分析サマリー
}

export async function analyzeForNextCaptures(
  screens: { snapshotTree: string; label: string; index: number }[],
  appPackage: string,
  appName: string,
  previouslyCoveredFeatures?: string[],
  onProgress?: ProgressCallback,
  logFile?: string,
  userFeedback?: string,
): Promise<IterativeAnalysisResult | null> {
  try {
    const systemPrompt = `あなたはAndroidアプリのUI構造分析の専門家です。キャプチャ済みの画面スナップショットツリーを分析し、まだキャプチャされていない画面や機能を特定してください。`;

    const screensText = screens
      .map(
        (s) =>
          `--- Screen (index: ${s.index}, label: "${s.label}") ---\n${s.snapshotTree || "(スナップショットなし)"}`,
      )
      .join("\n\n");

    let previouslyKnownSection = "";
    if (previouslyCoveredFeatures && previouslyCoveredFeatures.length > 0) {
      previouslyKnownSection = `\n前回の分析で把握済みの機能:\n${previouslyCoveredFeatures.map((f) => `- ${f}`).join("\n")}\n`;
    }

    let userFeedbackSection = "";
    if (userFeedback) {
      userFeedbackSection = `\n## ユーザーからの追加指示:\n${userFeedback}\n上記の指示を最優先で考慮し、キャプチャ戦略に反映してください。\n`;
    }

    const userPrompt = `以下のアプリの画面スナップショットを分析してください。

アプリ: ${appName} (${appPackage})
キャプチャ済み画面数: ${screens.length}

${screensText}
${previouslyKnownSection}${userFeedbackSection}
以下を分析してください：

1. **把握済み機能**: キャプチャ済み画面から読み取れる機能をすべてリストアップ
2. **未キャプチャ画面**: スナップショットツリー内にリンク・ボタン・タブ等で参照されているが、まだキャプチャされていない画面を特定
   - 各ターゲットについて、スナップショットツリー内のラベル（正確に一致する文字列）を指定
   - どの画面から遷移できるか
   - 優先度（1-10）
3. **新発見**: 前回の分析にはなかった新しい機能や導線
4. **完了判定**: すべての主要機能をカバーしたか

注意:
- targetLabelはスナップショットツリーの「ラベル」テキストをそのままコピーして指定すること
  - 例: スナップショットに @a1 [Button] "チャージする" とあれば、targetLabelは "チャージする"
  - 改行文字（&#10;や\\n）は除去して、スペースなしで連結した形で指定（例: "ごみ出し&#10;カレンダー" → "ごみ出しカレンダー"）
- fromScreenは必ず具体的な画面名を指定（"home"、画面のラベル名、またはタブ名）
- navigationHintに「○○タブの○○ボタン」のように具体的なナビゲーション手順を記載
- 外部リンク（ブラウザ等に遷移するもの）はuncapturedTargetsに含めない
- 設定画面の深い階層や利用規約などの低優先度画面は priority 1-3 にする
- メインの機能画面（ポイント管理、地図、カレンダーなど）は priority 7-10 にする
- スナップショットツリーに実際に存在するボタン/リンクのラベルのみをtargetLabelにすること（推測で存在しないラベルを作らない）

JSON形式で回答（JSONのみ出力、他のテキストは含めない）:
{
  "coveredFeatures": ["機能名1", "機能名2"],
  "uncapturedTargets": [
    {
      "featureName": "機能名",
      "navigationHint": "ホーム画面の「アイコン名」をタップ",
      "targetLabel": "スナップショットツリー内のラベル完全一致",
      "fromScreen": "home",
      "priority": 8
    }
  ],
  "newDiscoveries": ["新発見1"],
  "isComplete": false,
  "summary": "現在の分析サマリー"
}`;

    const text = await callClaudeCode(userPrompt, systemPrompt, onProgress, logFile);

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("[Iterative Analysis] No JSON found in response");
      return null;
    }

    const result: IterativeAnalysisResult = JSON.parse(jsonMatch[0]);

    // Sort uncapturedTargets by priority descending
    result.uncapturedTargets.sort((a, b) => b.priority - a.priority);

    return result;
  } catch (err) {
    console.error("[Iterative Analysis] Error:", err);
    return null;
  }
}

// ─── Final Report Generation ────────────────────────────────────────────────

export async function generateFinalReport(
  screens: { snapshotTree: string; label: string; index: number; screenshotPath: string }[],
  appPackage: string,
  appName: string,
  onProgress?: ProgressCallback,
  logFile?: string,
): Promise<InspectorReport | null> {
  const systemPrompt = `あなたはAndroidアプリのUI/UX分析の専門家です。
キャプチャされた全画面のスナップショットツリーを包括的に分析し、
アプリの構造レポートを生成してください。
出力はJSON形式のみ（他のテキストは含めない）。`;

  const screensText = screens
    .map((s) => `--- Screen (index: ${s.index}, label: "${s.label}") ---\n${s.snapshotTree || "(スナップショットなし)"}`)
    .join("\n\n");

  const userPrompt = `以下のAndroidアプリの全画面を分析し、包括的なレポートを生成してください。

アプリ: ${appName} (${appPackage})
キャプチャ画面数: ${screens.length}

${screensText}

以下の構造でJSONレポートを生成してください：

{
  "appOverview": {
    "description": "アプリの概要（3-5文）",
    "targetUsers": "想定ユーザー層",
    "appCategory": "アプリカテゴリ"
  },
  "screenMap": [
    {
      "screenId": "screen_0",
      "label": "画面名",
      "screenType": "home|list|detail|form|settings|menu|etc",
      "description": "この画面の役割の説明",
      "features": ["この画面で提供される機能"]
    }
  ],
  "screenTransitions": [
    {
      "from": "画面名",
      "to": "画面名",
      "trigger": "タップ対象（ボタン名/タブ名等）",
      "description": "遷移の説明"
    }
  ],
  "featureAnalysis": [
    {
      "category": "機能カテゴリ名",
      "features": [
        {
          "name": "機能名",
          "description": "機能の説明",
          "screens": ["関連画面名"],
          "importance": "core|secondary|utility"
        }
      ]
    }
  ],
  "appStructure": {
    "navigationPattern": "Tab Navigation (Bottom) | Drawer | Stack | etc",
    "informationArchitecture": "情報構造の説明",
    "keyFlows": [
      {
        "name": "主要フロー名",
        "steps": ["ステップ1", "ステップ2"]
      }
    ]
  },
  "characteristics": ["アプリの特徴1", "特徴2"],
  "issues": [
    {
      "severity": "critical|major|minor",
      "category": "UX|アクセシビリティ|情報設計|パフォーマンス",
      "description": "課題の説明",
      "affectedScreens": ["影響画面名"]
    }
  ],
  "competitorInsights": ["競合分析の所見1"],
  "summary": "全体サマリー（5-10文）"
}

注意:
- screenMapは全キャプチャ画面を含めること
- screenTransitionsはスナップショットツリーのボタン/タブ/リンクから推測
- featureAnalysisはアプリの全機能を網羅すること
- issuesは具体的で改善可能な内容にすること
- すべて日本語で出力`;

  try {
    const text = await callClaudeCode(userPrompt, systemPrompt, onProgress, logFile);

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("[Final Report] No JSON found in response");
      return null;
    }

    const report = JSON.parse(jsonMatch[0]);
    report.generatedAt = new Date().toISOString();
    return report as InspectorReport;
  } catch (err) {
    console.error("[Final Report] Error:", err);
    return null;
  }
}
