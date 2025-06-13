import React from 'react';
import { TranscriptLine } from '../types';

interface TimelineControlsProps {
  transcript: TranscriptLine[];
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
}

export const TimelineControls: React.FC<TimelineControlsProps> = ({
  transcript,
  currentTime,
  duration,
  onSeek,
}) => {
  return (
    <div className="mt-4 p-4 bg-gray-100 rounded-lg">
      <div className="relative h-20 bg-white rounded overflow-hidden">
        <input
          type="range"
          min="0"
          max={duration}
          value={currentTime}
          onChange={(e) => onSeek(parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        
        <div className="absolute inset-0 flex items-center">
          {transcript.map((line, index) => {
            const left = (line.start / duration) * 100;
            const width = ((line.end - line.start) / duration) * 100;
            const isActive = currentTime >= line.start && currentTime <= line.end;
            
            return (
              <div
                key={index}
                className={`absolute h-12 rounded transition-colors ${
                  isActive ? 'bg-blue-500' : 'bg-gray-300'
                }`}
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                }}
                title={line.text}
              />
            );
          })}
          
          <div
            className="absolute w-0.5 h-16 bg-red-500"
            style={{ left: `${(currentTime / duration) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
};