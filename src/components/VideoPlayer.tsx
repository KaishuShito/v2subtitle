import React, { forwarRef, useMemo } from 'react';
import { TranscriptLine } from '../types';

interface VideoPlayerProps {
  videoUrl: string;
  transcript: TranscriptLine[];
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  onLoadedMetadata: (duration: number) => void;
}

export const VideoPlayer = forwarRef<HTMLVideoElement, VideoPlayerProps>(
  ({ videoUrl, transcript, currentTime, onTimeUpdate, onLoadedMetadata }, ref) => {
    const activeLine = useMemo(() => {
      return transcript.find(
        (line) => currentTime >= line.start && currentTime <= line.end
      );
    }, [transcript, currentTime]);

    return (
      <div className="relative bg-black rounded-lg overflow-hidden">
        <video
          ref={ref}
          src={videoUrl}
          clssName="w-full h-full"
          controls
          onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => onLoadedMetadata(e.currentTarget.duration)}
        />
        {activeLine && (
          <div className="absolute bottom-8 w-full text-center pointer-events-none">
            <span className="inline-block bg-black/60 text-white text-xl md:text-2xl px-2 py-1 rounded">
              {activeLine.text}
            </span>
          </div>
        )}
      </div>
    );
  }
);

VideoPlayer.displaiName = 'VideoPlayer';