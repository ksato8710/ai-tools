"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { MeetingSession, WhisperStatus } from "@/lib/meeting-schema";
import MeetingTranscript from "./MeetingTranscript";
import MeetingSummary from "./MeetingSummaryPanel";

interface Props {
  session: MeetingSession;
  onUpdate: (session: MeetingSession) => void;
}

export default function MeetingRecorder({ session, onUpdate }: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [whisperStatus, setWhisperStatus] = useState<WhisperStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);

  // Check whisper status on mount
  useEffect(() => {
    fetch("/api/meeting/status")
      .then((r) => r.json())
      .then(setWhisperStatus)
      .catch(() => {});
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });

      chunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await uploadAudio(blob);
      };

      mediaRecorder.start(1000); // collect data every second
      startTimeRef.current = Date.now();
      pausedTimeRef.current = 0;
      setIsRecording(true);
      setIsPaused(false);

      // Update session status
      await fetch(`/api/meeting/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "recording" }),
      });

      // Timer
      timerRef.current = setInterval(() => {
        setElapsed(
          Math.floor((Date.now() - startTimeRef.current - pausedTimeRef.current) / 1000)
        );
      }, 200);
    } catch (err) {
      setError(
        err instanceof Error
          ? `マイクへのアクセスが拒否されました: ${err.message}`
          : "録音を開始できませんでした"
      );
    }
  }, [session.id]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        startTimeRef.current = Date.now() - elapsed * 1000;
        setIsPaused(false);
      } else {
        mediaRecorderRef.current.pause();
        setIsPaused(true);
      }
    }
  }, [isRecording, isPaused, elapsed]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRecording]);

  const uploadAudio = async (blob: Blob) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("audio", new File([blob], "recording.webm", { type: "audio/webm" }));
      formData.append("duration", elapsed.toString());

      const res = await fetch(`/api/meeting/${session.id}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");
      const updated = await res.json();
      onUpdate(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "アップロードに失敗しました");
    } finally {
      setIsUploading(false);
    }
  };

  const startTranscribe = async () => {
    setIsTranscribing(true);
    setError(null);
    try {
      const res = await fetch(`/api/meeting/${session.id}/transcribe`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.setup) {
          setError(
            `${data.error}\n\nセットアップ手順:\n${data.setup.join("\n")}`
          );
        } else {
          setError(data.error || "文字起こしに失敗しました");
        }
        return;
      }
      onUpdate(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "文字起こしに失敗しました");
    } finally {
      setIsTranscribing(false);
    }
  };

  const startSummarize = async () => {
    setIsSummarizing(true);
    setError(null);
    try {
      const res = await fetch(`/api/meeting/${session.id}/summarize`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "要約に失敗しました");
        return;
      }
      onUpdate(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "要約に失敗しました");
    } finally {
      setIsSummarizing(false);
    }
  };

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0)
      return `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const canRecord = session.status === "ready" || session.status === "error";
  const canTranscribe =
    session.status === "recorded" && !isTranscribing;
  const canSummarize =
    session.status === "completed" && session.rawTranscript && !isSummarizing && !session.summary;

  return (
    <div className="space-y-6">
      {/* Whisper Status Banner */}
      {whisperStatus && !whisperStatus.available && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-[12px] p-4">
          <p className="text-sm font-medium text-yellow-800 mb-2">
            Whisper セットアップが必要です
          </p>
          <p className="text-xs text-yellow-700 mb-3">{whisperStatus.message}</p>
          <div className="bg-yellow-100/60 rounded-lg p-3">
            <pre className="text-xs text-yellow-900 whitespace-pre-wrap font-mono">
{`# whisper.cpp のインストール
git clone https://github.com/ggml-org/whisper.cpp ~/whisper.cpp
cd ~/whisper.cpp
cmake -B build -DWHISPER_METAL=ON
cmake --build build -j

# モデルのダウンロード（Medium推奨）
bash ./models/download-ggml-model.sh medium`}
            </pre>
          </div>
          {!whisperStatus.ffmpegAvailable && (
            <pre className="text-xs text-yellow-900 mt-2 font-mono">
              brew install ffmpeg
            </pre>
          )}
        </div>
      )}

      {/* Recording Controls */}
      <div className="bg-card rounded-[16px] border border-border-light p-6">
        <div className="text-center">
          {/* Timer Display */}
          <div className="mb-6">
            <span className="font-mono text-5xl font-bold text-text-primary tracking-wider">
              {formatTime(isRecording ? elapsed : session.duration ? Math.floor(session.duration) : 0)}
            </span>
            {isRecording && (
              <div className="flex items-center justify-center gap-2 mt-2">
                <span className={`w-2.5 h-2.5 rounded-full ${isPaused ? "bg-yellow-500" : "bg-red-500 animate-pulse"}`} />
                <span className="text-sm text-text-secondary">
                  {isPaused ? "一時停止中" : "録音中..."}
                </span>
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-center gap-3">
            {canRecord && !isRecording && (
              <button
                onClick={startRecording}
                className="flex items-center gap-2 px-6 py-3 bg-red-500 text-white rounded-full font-medium hover:bg-red-600 transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <circle cx="9" cy="9" r="7" fill="currentColor" />
                </svg>
                録音開始
              </button>
            )}

            {isRecording && (
              <>
                <button
                  onClick={pauseRecording}
                  className="flex items-center gap-2 px-5 py-3 bg-card border border-border-light rounded-full font-medium text-text-primary hover:bg-cream transition-colors"
                >
                  {isPaused ? (
                    <>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M5 3l8 5-8 5V3z" fill="currentColor" />
                      </svg>
                      再開
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <rect x="4" y="3" width="3" height="10" rx="1" fill="currentColor" />
                        <rect x="9" y="3" width="3" height="10" rx="1" fill="currentColor" />
                      </svg>
                      一時停止
                    </>
                  )}
                </button>
                <button
                  onClick={stopRecording}
                  className="flex items-center gap-2 px-5 py-3 bg-text-primary text-white rounded-full font-medium hover:bg-gray-800 transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <rect x="3" y="3" width="10" height="10" rx="2" fill="currentColor" />
                  </svg>
                  録音停止
                </button>
              </>
            )}
          </div>

          {isUploading && (
            <p className="mt-4 text-sm text-text-secondary animate-pulse">
              音声ファイルを保存中...
            </p>
          )}
        </div>
      </div>

      {/* Audio Player */}
      {session.audioPath && (session.status === "recorded" || session.status === "completed") && (
        <div className="bg-card rounded-[16px] border border-border-light p-6">
          <h3 className="font-[family-name:var(--font-nunito)] font-bold text-text-primary mb-3">
            録音ファイル
          </h3>
          <div className="flex items-center gap-3 text-xs text-text-secondary mb-3">
            <span className="bg-cream px-2 py-1 rounded font-mono">
              {session.audioFileName}
            </span>
            {session.duration && (
              <span>{formatTime(Math.floor(session.duration))}</span>
            )}
          </div>
          <audio
            controls
            className="w-full"
            src={`/api/meeting/${session.id}/audio`}
          />
        </div>
      )}

      {/* Transcribe Button */}
      {canTranscribe && (
        <div className="flex items-center gap-3">
          <button
            onClick={startTranscribe}
            disabled={isTranscribing}
            className="flex items-center gap-2 px-6 py-3 bg-accent-leaf text-white rounded-full font-medium hover:bg-accent-leaf/90 transition-colors disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M3 9h2l2-4 3 8 2-4h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            文字起こし開始
          </button>
          {whisperStatus?.available && (
            <span className="text-xs text-text-muted">whisper.cpp (Metal GPU加速)</span>
          )}
        </div>
      )}

      {isTranscribing && (
        <div className="bg-card rounded-[16px] border border-border-light p-6 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-accent-leaf/20 border-t-accent-leaf rounded-full mx-auto mb-3" />
          <p className="text-sm text-text-secondary">
            whisper.cpp で文字起こし中...（Metal GPU加速）
          </p>
          <p className="text-xs text-text-muted mt-1">
            音声の長さにより数分かかる場合があります
          </p>
        </div>
      )}

      {/* Transcript */}
      {session.transcript && session.transcript.length > 0 && (
        <MeetingTranscript
          segments={session.transcript}
          rawTranscript={session.rawTranscript}
        />
      )}

      {/* Summarize Button */}
      {canSummarize && (
        <button
          onClick={startSummarize}
          disabled={isSummarizing}
          className="flex items-center gap-2 px-6 py-3 bg-accent-bark text-white rounded-full font-medium hover:bg-accent-bark/90 transition-colors disabled:opacity-50"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M4 5h10M4 9h7M4 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          AIで議事録を生成
        </button>
      )}

      {isSummarizing && (
        <div className="bg-card rounded-[16px] border border-border-light p-6 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-accent-bark/20 border-t-accent-bark rounded-full mx-auto mb-3" />
          <p className="text-sm text-text-secondary">
            Claude AIが議事録を生成中...
          </p>
        </div>
      )}

      {/* Summary */}
      {session.summary && <MeetingSummary summary={session.summary} />}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-[12px] p-4">
          <p className="text-sm text-red-700 whitespace-pre-wrap">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-2 text-xs text-red-500 hover:text-red-700"
          >
            閉じる
          </button>
        </div>
      )}
    </div>
  );
}
