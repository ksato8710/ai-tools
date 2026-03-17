export interface MeetingSession {
  id: string;
  title: string;
  status: "ready" | "recording" | "recorded" | "transcribing" | "processing" | "completed" | "error";
  audioPath?: string;
  audioFileName?: string;
  duration?: number; // seconds
  transcript?: TranscriptSegment[];
  rawTranscript?: string;
  refinedTranscript?: string;
  summary?: MeetingSummary;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TranscriptSegment {
  start: string; // "00:00:00.000"
  end: string;
  speaker?: string;
  text: string;
}

export interface MeetingSummary {
  overview: string;
  keyPoints: string[];
  actionItems: ActionItem[];
  decisions: string[];
}

export interface ActionItem {
  task: string;
  assignee?: string;
  deadline?: string;
}

export interface DictionaryEntry {
  id: string;
  word: string;     // 正しい固有名詞（人名、社名、製品名など）
  category?: "person" | "company" | "product" | "other";
  createdAt: string;
}

export interface WhisperStatus {
  available: boolean;
  path?: string;
  modelPath?: string;
  ffmpegAvailable: boolean;
  message: string;
}
