import React from 'react';
import { TranscriptLine } from '../types';
import { formatTime } from '../utils/time';

interface TranscriptViewerProps {
  transcript: TranscriptLine[];
  currentTime: number;
  onLineClick: (line: TranscriptLine) => void;
  onLineEdit: (index: number, text: string) => void;
  onLineDelete: (index: number) => void;
}

export const TranscriptViewer: React.FC<TranscriptViewerProps> = ({
  transcript,
  currentTime,
  onLineClick,
  onLineEdit,
  onLineDelete,
}) => {
  return (
    <div className="space-y-2 max-h-96 overflow-y-auto p-4 bg-gray-50 rounded-lg">
      {transcript.map((line, index) => {
        const isActive = currentTime >= line.start && currentTime <= line.end;
        
        return (
          <div
            key={index}
            className={`p-3 rounded cursor-pointer transition-colors ${
              isActive ? 'bg-blue-100 border-blue-500 border' : 'bg-white hover:bg-gray-100'
            }`}
            onClick={() => onLineClick(line)}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">
                {formatTime(line.start)} - {formatTime(line.end)}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onLineDelete(index);
                }}
                className="text-red-500 hover:text-red-700 text-sm"
              >
                削除
              </button>
            </div>
            <input
              type="text"
              value={line.text}
              onChange={(e) => onLineEdit(index, e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="w-full p-1 border rounded text-sm"
            />
          </div>
        );
      })}
    </div>
  );
};