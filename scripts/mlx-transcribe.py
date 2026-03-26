#!/usr/bin/env python3
"""
mlx-whisper transcription script for ai-tools meeting recorder.
Outputs SRT format to a specified file.

Usage:
  python3 mlx-transcribe.py <audio_path> <output_srt_path> [--language ja] [--model mlx-community/whisper-small-mlx] [--prompt "..."]
"""

import argparse
import sys

import mlx_whisper


def format_timestamp(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = seconds % 60
    return f"{h:02d}:{m:02d}:{s:06.3f}".replace(".", ",")


def segments_to_srt(segments: list) -> str:
    lines = []
    for i, seg in enumerate(segments, 1):
        start = format_timestamp(seg["start"])
        end = format_timestamp(seg["end"])
        text = seg["text"].strip()
        if not text:
            continue
        lines.append(f"{i}")
        lines.append(f"{start} --> {end}")
        lines.append(text)
        lines.append("")
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Transcribe audio using mlx-whisper")
    parser.add_argument("audio", help="Path to the audio file")
    parser.add_argument("output", help="Path for the output SRT file")
    parser.add_argument("--language", default="ja", help="Language code (default: ja)")
    parser.add_argument(
        "--model",
        default="mlx-community/whisper-small-mlx",
        help="HuggingFace model repo (default: mlx-community/whisper-small-mlx)",
    )
    parser.add_argument("--prompt", default=None, help="Initial prompt for Whisper")
    args = parser.parse_args()

    kwargs = {
        "language": args.language,
        "path_or_hf_repo": args.model,
        "verbose": False,
    }
    if args.prompt:
        kwargs["initial_prompt"] = args.prompt

    result = mlx_whisper.transcribe(args.audio, **kwargs)

    segments = result.get("segments", [])
    srt_content = segments_to_srt(segments)

    with open(args.output, "w", encoding="utf-8") as f:
        f.write(srt_content)

    print(f"OK: {len(segments)} segments written to {args.output}", file=sys.stderr)


if __name__ == "__main__":
    main()
