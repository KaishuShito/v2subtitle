import { TranscriptLine } from '../types';
import { formatTime } from './time';

export const generateSRT = (transcript: TranscriptLine[]): string => {
  return transcript
    .map((line, index) => {
      return `${index + 1}\n${formatTime(line.start)} --> ${formatTime(
        line.end
      )}\n${line.text}\n`;
    })
    .join('\n');
};

export const validateTranscript = (transcript: TranscriptLine[]): boolean => {
  if (!Array.isArray(transcript) || transcript.length === 0) {
    return false;
  }
  
  return transcript.every(line => 
    typeof line.start === 'number' &&
    typeof line.end === 'number' &&
    typeof line.text === 'string' &&
    line.start >= 0 &&
    line.end > line.start &&
    line.text.trim().length > 0
  );
};