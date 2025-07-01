import React, { useState } from 'react';
import { TranscriptLine } from '../types';
import { generateSRT } from '../utils/transcript';

interface SubtitleControlsProps {
  transcript: TranscriptLine[];
  onBurnSubtitles: (language: string) => void;
  isProcessing: boolean;
}

/**
 * 字幕コントロールコンポーネント
 * 字幕の言語選択、SRTファイルのダウンロード、字幕の焼き込み機能を提供する
 * 
 * @param props - コンポーネントのプロパティ
 * @param props.transcript - 字幕データの配列（TranscriptLine型）
 * @param props.onBurnSubtitles - 字幕焼き込み処理を実行するコールバック関数
 * @param props.isProcessing - 処理中かどうかを示すフラグ
 * @returns 字幕コントロールのJSX要素
 */
export const SubtitleControls: React.FC<SubtitleControlsProps> = ({
  transcript,
  onBurnSubtitles,
  isProcessing,
}) => {
  const [selectedLanguage, setSelectedLanguage] = useState<string>('japanese');
  
  /**
   * SRTファイルをダウンロードする関数
   * transcriptデータからSRT形式のファイルを生成し、ブラウザ経由でダウンロードする
   * 
   * @returns void
   */
  const downloadSRT = () => {
    const srtContent = generateSRT(transcript);
    const blob = new Blob([srtContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'subtitles.srt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-gray-700">
          字幕言語:
        </label>
        <select
          value={selectedLanguage}
          onChange={(e) => setSelectedLanguage(e.target.value)}
          className="px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="japanese">日本語のみ</option>
          <option value="english">英語のみ（音声のみ）</option>
          <option value="both">両方（日本語字幕）</option>
        </select>
      </div>
      
      <div className="flex gap-4">
        <button
          onClick={downloadSRT}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition-colors"
        >
          SRTファイルをダウンロード
        </button>
        
        <button
          onClick={() => onBurnSubtitles(selectedLanguage)}
          disabled={isProcessing || transcript.length === 0}
          className={`px-4 py-2 rounded transition-colors ${
            isProcessing || transcript.length === 0
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
        >
          {isProcessing ? '処理中...' : '字幕を焼き込む'}
        </button>
      </div>
    </div>
  );
};