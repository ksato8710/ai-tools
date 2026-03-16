import { NextResponse } from "next/server";
import { getSession, saveSession } from "@/lib/presentation-store";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const PUBLIC_DIR = path.join(process.cwd(), "public", "presentation");

const POLLINATIONS_API_KEY = process.env.POLLINATIONS_API_KEY || "";

/**
 * POST /api/presentation/:sessionId/generate-image
 *
 * Generate an image for a slide using Pollinations.ai (Flux model).
 *
 * Body: {
 *   slideId: string
 *   prompt: string       // English prompt for image generation
 *   width?: number       // default 1920
 *   height?: number      // default 1080
 *   overlay?: string     // CSS overlay color, e.g. "rgba(0,0,0,0.5)"
 * }
 *
 * Returns: { imageUrl: string, slideId: string }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const { slideId, prompt, width = 1920, height = 1080, overlay } =
    await request.json();
  if (!slideId || !prompt) {
    return NextResponse.json(
      { error: "slideId and prompt are required" },
      { status: 400 }
    );
  }

  // Generate image via Pollinations.ai
  const encodedPrompt = encodeURIComponent(prompt);
  const url = `https://gen.pollinations.ai/image/${encodedPrompt}?model=flux&width=${width}&height=${height}&nologo=true`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${POLLINATIONS_API_KEY}`,
      },
      signal: AbortSignal.timeout(90_000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Pollinations API error: ${response.status} ${response.statusText}` },
        { status: 502 }
      );
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // Save to public/presentation/{sessionId}_{slideId}.jpg
    await mkdir(PUBLIC_DIR, { recursive: true });
    const fileName = `${sessionId}_${slideId}.jpg`;
    const filePath = path.join(PUBLIC_DIR, fileName);
    await writeFile(filePath, buffer);

    const imageUrl = `/presentation/${fileName}`;

    // Update session: set backgroundImage on the slide
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const slides = session.presentation.slides as any[];
    const slideIndex = slides.findIndex(
      (s: { id: string }) => s.id === slideId
    );
    if (slideIndex !== -1) {
      slides[slideIndex].backgroundImage = imageUrl;
      if (overlay) {
        slides[slideIndex].backgroundOverlay = overlay;
      }
      await saveSession(session);
    }

    return NextResponse.json({
      imageUrl,
      slideId,
      fileName,
      size: buffer.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Image generation failed: ${msg}` },
      { status: 500 }
    );
  }
}

/**
 * POST /api/presentation/:sessionId/generate-image/bulk
 * (handled by a separate route — this single-slide endpoint is simpler)
 */
