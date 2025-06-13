export interface TranscriptLine {
  start: number;
  end: number;
  text: string;
}

export interface TranscribeResponse {
  transcript: TranscriptLine[];
}

export interface BurnSubtitlesRequest {
  videoFile: string;
  transcript: TranscriptLine[];
  outputPath: string;
}

export interface YouTubeDownloadRequest {
  url: string;
}

export interface YouTubeDownloadResponse {
  filePath: string;
}

export interface VideoEditorState {
  transcript: TranscriptLine[];
  currentTime: number;
  isPlaying: boolean;
  selectedLines: Set<number>;
}