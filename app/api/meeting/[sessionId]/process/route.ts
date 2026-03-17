import { NextResponse } from "next/server";
import { getSession, saveSession } from "@/lib/meeting-store";
import { callClaude } from "@/lib/meeting-claude";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (!session.rawTranscript) {
    return NextResponse.json({ error: "No transcript available" }, { status: 400 });
  }

  try {
    // ── Step 1: Refine ──────────────────────────────────────────────────
    if (!session.refinedTranscript) {
      session.updatedAt = new Date().toISOString();
      await saveSession(session); // save "processing" state for polling

      const refinePrompt = `あなたは会議の文字起こしを整文するエディターです。以下の音声認識テキストを、読みやすい文章に整えてください。

## ルール
- 内容は一切削除・省略しないでください。すべての発言を残してください
- 「えー」「あの」「うーん」などのフィラーは除去してください
- 句読点を適切に付与してください
- 明らかな認識ミス（同音異義語の誤り等）は文脈から推測して修正してください
- 話者の交代が推測できる場合は改行で区切ってください
- 敬体・常体は元の発言のまま維持してください
- 追加の要約や注釈は不要です。整文した本文のみを出力してください

## 文字起こし原文
${session.rawTranscript}

整文した本文のみを出力してください。`;

      session.refinedTranscript = await callClaude(refinePrompt);
      session.updatedAt = new Date().toISOString();
      await saveSession(session); // polling picks up refinedTranscript
    }

    // ── Step 2: Summarize ───────────────────────────────────────────────
    const transcriptSource = session.refinedTranscript;

    const summarizePrompt = `以下は会議の整文済みトランスクリプトです。議事録として要約してください。

## 出力フォーマット（JSON）
{
  "overview": "会議の概要（2-3文）",
  "keyPoints": ["要点1", "要点2", ...],
  "actionItems": [{"task": "タスク内容", "assignee": "担当者（わかれば）", "deadline": "期限（わかれば）"}],
  "decisions": ["決定事項1", "決定事項2", ...]
}

## 整文済みトランスクリプト
${transcriptSource}

JSONのみを出力してください。`;

    const text = await callClaude(summarizePrompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Failed to parse summary" }, { status: 500 });
    }

    session.summary = JSON.parse(jsonMatch[0]);
    session.updatedAt = new Date().toISOString();
    await saveSession(session);

    // ── Step 3: Title ───────────────────────────────────────────────────
    try {
      const titlePrompt = `以下は会議の文字起こしの冒頭です。この会議の内容を端的に表す短いタイトル（20文字以内）を1つだけ出力してください。タイトルのみ出力し、他は何も出力しないでください。\n\n${transcriptSource.slice(0, 2000)}`;
      const titleResult = await callClaude(titlePrompt, "haiku");
      const title = titleResult.trim().replace(/^[「『"]|[」』"]$/g, "");
      if (title && title.length <= 30) {
        session.title = title;
        session.updatedAt = new Date().toISOString();
        await saveSession(session);
      }
    } catch {
      // Title generation is optional, don't fail the pipeline
    }

    return NextResponse.json(session);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Processing failed" },
      { status: 500 }
    );
  }
}
