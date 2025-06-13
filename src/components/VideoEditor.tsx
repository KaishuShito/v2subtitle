import React, { useState, useRef } from 'react';
import { TranscriptLine } from '../types';
import { VideoPlayer } from './VideoPlayer';
import { TranscriptViewer } from './TranscriptViewer';
import { TimelineControls } from './TimelineControls';
import { SubtitleControls } from './SubtitleControls';

interface VideoEditorProps {
  videoUrl: string;
  transcript: TranscriptLine[];
  videoFile: File | null;
  onTranscriptChange: (transcript: TranscriptLine[]) => void;
}

export default function VideoEditor({ 
  videoUrl, 
  transcript, 
  videoFile,
  onTranscriptChange 
}: VideoEditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleLineClick = (line: TranscriptLine) => {
    if (videoRef.current) {
      videoRef.current.currentTime = line.start;
    }
  };

  const handleLineEdit = (index: number, text: string) => {
    const newTranscript = [...transcript];
    newTranscript[index] = { ...newTranscript[index], text };
    onTranscriptChange(newTranscript);
  };

  const handleLineDelete = (index: number) => {
    const newTranscript = transcript.filter((_, i) => i !== index);
    onTranscriptChange(newTranscript);
  };

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const handleBurnSubtitles = async (language: string) => {
    if (!videoFile || transcript.length === 0) return;
    
    setIsProcessing(true);
    
    try {
      const formData = new FormData();
      formData.append('video', videoFile);
      formData.append('transcript', JSON.stringify(transcript));
      formData.append('language', language);
      
      const response = await fetch('/api/burn-subtitles', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) throw new Error('Failed to process video');
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = 'subtitled-video.mp4';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Burn subtitles error:', error);
      alert('字幕付き動画の生成に失敗しました');
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <VideoPlayer
            ref={videoRef}
            videoUrl={videoUrl}
            transcript={transcript}
            currentTime={currentTime}
            onTimeUpdate={setCurrentTime}
            onLoadedMetadata={setDuration}
          />
          
          <TimelineControls
            transcript={transcript}
            currentTime={currentTime}
            duration={duration}
            onSeek={handleSeek}
          />
          
          <SubtitleControls
            transcript={transcript}
            onBurnSubtitles={handleBurnSubtitles}
            isProcessing={isProcessing}
          />
        </div>
        
        <div>
          <h3 className="text-lg font-bold mb-4">文字起こし編集</h3>
          <TranscriptViewer
            transcript={transcript}
            currentTime={currentTime}
            onLineClick={handleLineClick}
            onLineEdit={handleLineEdit}
            onLineDelete={handleLineDelete}
          />
        </div>
      </div>
    </div>
  );
}