import { NextResponse } from "next/server";
import { getDictionary, saveDictionary } from "@/lib/meeting-store";

export async function GET() {
  const entries = await getDictionary();
  return NextResponse.json(entries);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { word, category } = body;

  if (!word) {
    return NextResponse.json({ error: "word is required" }, { status: 400 });
  }

  const entries = await getDictionary();

  const existing = entries.find((e) => e.word === word);
  if (existing) {
    existing.category = category || existing.category;
  } else {
    entries.push({
      id: `dict-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      word: word.trim(),
      category: category || "other",
      createdAt: new Date().toISOString(),
    });
  }

  await saveDictionary(entries);
  return NextResponse.json(entries);
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const entries = await getDictionary();
  const filtered = entries.filter((e) => e.id !== id);
  await saveDictionary(filtered);
  return NextResponse.json(filtered);
}
