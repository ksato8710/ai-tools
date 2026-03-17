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

  const transcriptSource = session.refinedTranscript || session.rawTranscript;
  if (!transcriptSource) {
    return NextResponse.json({ error: "No transcript available" }, { status: 400 });
  }

  try {
    session.status = "processing";
    delete session.errorMessage;
    session.updatedAt = new Date().toISOString();
    await saveSession(session);

    const sourceLabel = session.refinedTranscript ? "整文済みトランスクリプト" : "音声トランスクリプト";
    const prompt = `以下は会議の${sourceLabel}です。議事録として要約してください。

## 出力フォーマット（JSON）
{
  "overview": "会議の概要（2-3文）",
  "keyPoints": ["要点1", "要点2", ...],
  "actionItems": [{"task": "タスク内容", "assignee": "担当者（わかれば）", "deadline": "期限（わかれば）"}],
  "decisions": ["決定事項1", "決定事項2", ...]
}

## ${sourceLabel}
${transcriptSource}

JSONのみを出力してください。`;

    const text = await callClaude(prompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Failed to parse summary" }, { status: 500 });
    }

    session.summary = JSON.parse(jsonMatch[0]);
    session.status = "completed";
    delete session.errorMessage;
    session.updatedAt = new Date().toISOString();
    await saveSession(session);

    return NextResponse.json(session);
  } catch (err) {
    session.status = "error";
    session.errorMessage = err instanceof Error ? err.message : "Summary failed";
    session.updatedAt = new Date().toISOString();
    await saveSession(session);

    return NextResponse.json(
      { error: session.errorMessage },
      { status: 500 }
    );
  }
}
