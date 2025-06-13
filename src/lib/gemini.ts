import { GoogleGenerativeAI } from '@google/generative-ai'
import { TranscriptLine } from '../types'
import path from 'path'
import fs from 'fs'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

// Utility to get audio duration
async function getAudioDurationSeconds(filePath: string): Promise<number> {
  const cmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`;
  const { stdout } = await execAsync(cmd);
  const duration = parseFloat(stdout.trim());
  if (isNaN(duration)) throw new Error('Failed to read audio duration');
  return duration;
}

// Split audio file into segments of fixed duration (in seconds) using FFmpeg
export async function splitAudioFile(
  inputPath: string,
  segmentDurationSec: number = 240,
  overlapSec: number = 5
): Promise<string[]> {
  const duration = await getAudioDurationSeconds(inputPath);
  const dir = path.dirname(inputPath);
  const ext = path.extname(inputPath).replace('.', '') || 'mp3';
  const uniquePrefix = `chunk-${Date.now()}`;

  const chunkPaths: string[] = [];

  let start = 0;
  let index = 0;
  while (start < duration) {
    const actualDuration = Math.min(segmentDurationSec + overlapSec, duration - start);
    const outputPath = path.join(dir, `${uniquePrefix}-${String(index).padStart(3, '0')}.${ext}`);
    const cmd = `ffmpeg -y -ss ${start} -t ${actualDuration} -i "${inputPath}" -c copy "${outputPath}" -loglevel error`;
    await execAsync(cmd);
    chunkPaths.push(outputPath);

    start += segmentDurationSec; // move start by segment, leaving overlap at the end of each chunk
    index++;
  }

  return chunkPaths;
}

// Helper to merge adjusted lines skipping overlaps already covered
function mergeTranscript(base: TranscriptLine[], next: TranscriptLine[]): TranscriptLine[] {
  if (base.length === 0) return next;
  const lastEnd = base[base.length - 1].end;

  // Keep only lines that extend past the last end to avoid duplicates/overlaps
  const filtered = next.filter((l) => l.end > lastEnd + 0.1);
  return base.concat(filtered);
}

// Transcribe long audio by splitting into chunks and stitching the results back together
export async function transcribeLongAudio(
  inputPath: string,
  mimeType: string,
  segmentDurationSec: number = 240,
  overlapSec: number = 5
): Promise<TranscriptLine[]> {
  const chunkPaths = await splitAudioFile(inputPath, segmentDurationSec, overlapSec);

  let transcript: TranscriptLine[] = [];

  for (let i = 0; i < chunkPaths.length; i++) {
    const chunkPath = chunkPaths[i];
    const audioData = fs.readFileSync(chunkPath);

    const chunkTranscript = await transcribeAudio(audioData, mimeType);

    const offset = i * segmentDurationSec;
    const adjusted = chunkTranscript.map((line) => ({
      ...line,
      start: line.start + offset,
      end: line.end + offset,
    }));

    transcript = mergeTranscript(transcript, adjusted);

    // clean up
    try {
      await fs.promises.unlink(chunkPath);
    } catch {
      /* ignore */
    }
  }

  return transcript;
}

export async function transcribeAudio(audioData: Buffer, mimeType: string): Promise<TranscriptLine[]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
  
  const base64Audio = audioData.toString('base64')
  
  const prompt = `次の音声を文字起こしして、タイムスタンプ付きで日本語に翻訳してください。
フォーマット:
[MM:SS] 日本語訳

重要: 英語の原文は含めず、日本語訳のみを出力してください。
音声に含まれる全ての内容を漏れなく文字起こしし、自然な日本語に翻訳してください。
各発言や重要な内容の切れ目でタイムスタンプを付けてください。`

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        mimeType: mimeType,
        data: base64Audio,
      },
    },
  ])

  const response = result.response
  const text = response.text()
  
  // Parse the response into TranscriptLine array
  const lines = text.split('\n').filter(line => line.trim())
  const transcript: TranscriptLine[] = []
  
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/\[(\d{2}):(\d{2})\]\s*(.*)/)
    if (match) {
      const minutes = parseInt(match[1])
      const seconds = parseInt(match[2])
      const startTime = minutes * 60 + seconds
      
      // Calculate end time based on next timestamp or add 3 seconds
      let endTime = startTime + 3
      if (i < lines.length - 1) {
        const nextMatch = lines[i + 1].match(/\[(\d{2}):(\d{2})\]/)
        if (nextMatch) {
          const nextMinutes = parseInt(nextMatch[1])
          const nextSeconds = parseInt(nextMatch[2])
          endTime = nextMinutes * 60 + nextSeconds
        }
      }
      
      transcript.push({
        start: startTime,
        end: endTime,
        text: match[3].trim()
      })
    }
  }
  
  return transcript
}