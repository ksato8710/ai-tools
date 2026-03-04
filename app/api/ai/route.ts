import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai";
import {
  generateERPrompt,
  suggestEntitiesPrompt,
  suggestAttributesPrompt,
  normalizationCheckPrompt,
} from "@/lib/er-ai-prompts";
import type { ERDiagram } from "@/lib/er-schema";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { action, data } = body as {
      action: "generate" | "suggest-entities" | "suggest-attributes" | "normalization-check";
      data: Record<string, unknown>;
    };

    let prompt: string;

    switch (action) {
      case "generate":
        prompt = generateERPrompt(data.input as string);
        break;
      case "suggest-entities":
        prompt = suggestEntitiesPrompt(data.diagram as ERDiagram);
        break;
      case "suggest-attributes":
        prompt = suggestAttributesPrompt(
          data.entityName as string,
          data.existingAttributes as string[]
        );
        break;
      case "normalization-check":
        prompt = normalizationCheckPrompt(data.diagram as ERDiagram);
        break;
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    const client = getOpenAIClient();
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 4000,
    });

    const content = completion.choices[0]?.message?.content ?? "";

    // Parse JSON from response
    const jsonMatch = content.match(/[\[{][\s\S]*[\]}]/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Failed to parse AI response" },
        { status: 500 }
      );
    }

    const result = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ result });
  } catch (error) {
    console.error("AI API error:", error);
    return NextResponse.json(
      { error: "AI processing failed" },
      { status: 500 }
    );
  }
}
