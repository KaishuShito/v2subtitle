import type { NextApiRequest, NextApiResponse } from 'next'
import formidable from 'formidable'
import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { TranscriptLine } from '@/types'
import { generateSRT } from '@/utils/transcript'
import { cleanupTempFiles } from '@/utils/cleanup'
import { ensureTmpDirectory } from '@/utils/init'

const execAsync = promisify(exec)

export const config = {
  api: {
    bodyParser: false,
    maxDuration: 300, // 5 minutes for video processing
  },
}

function createASSFile(transcript: TranscriptLine[], outputPath: string, language: string, fontSize: number): void {
  let processedTranscript = transcript;
  
  if (language === 'english') {
    processedTranscript = [{
      start: 0,
      end: 5,
      text: 'English subtitles not available - original audio only'
    }];
  } else if (language === 'japanese') {
    processedTranscript = transcript.map(line => {
      let cleanedText = line.text;
      
      // 英語と日本語が混在する場合の処理
      const japanesePattern = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
      const englishBeforeJapanese = /^[A-Za-z0-9\s,.!?"'-]+(?=[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF])/g;
      const quotedEnglish = /"[^"\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+"/g;
      
      cleanedText = cleanedText.replace(englishBeforeJapanese, '');
      cleanedText = cleanedText.replace(quotedEnglish, '');
      
      if (!japanesePattern.test(cleanedText)) {
        cleanedText = '';
      }
      
      return {
        ...line,
        text: cleanedText.trim()
      };
    }).filter(line => line.text.length > 0);
  }

  // ASS形式のヘッダーを作成（背景ボックス付き）
  const marginV = Math.round((1080 * fontSize) / 19.44 * 0.05);
  const assHeader = [
    '[Script Info]',
    'Title: Subtitle',
    'ScriptType: v4.00+',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    // BorderStyle=3、Outline=2で黒い輪郭を半透明背景として使用
    `Style: Default,Arial,${fontSize},&H00FFFFFF,&H000000FF,&H99000000,&H99000000,0,0,0,0,100,100,0,0,3,2,0,2,10,10,${marginV},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    ''
  ].join('\n');

  // 各字幕行をASS形式に変換（バックスラッシュエスケープを修正）
  const assEvents = processedTranscript.map(line => {
    const startTime = formatASSTime(line.start);
    const endTime = formatASSTime(line.end);
    // シンプルなテキストで、スタイルの背景設定を使用
    return `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${line.text}`;
  }).join('\n');

  const assContent = assHeader + assEvents;
  fs.writeFileSync(outputPath, assContent, 'utf8');
}

// ASS時間形式に変換 (H:MM:SS.CC)
function formatASSTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const centiseconds = Math.floor((seconds % 1) * 100);
  return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
}

function createSRTFile(transcript: TranscriptLine[], outputPath: string, language: string): void {
  let processedTranscript = transcript;
  
  if (language === 'english') {
    // For English-only, we don't have English text, so we'll show a message
    processedTranscript = [{
      start: 0,
      end: 5,
      text: 'English subtitles not available - original audio only'
    }];
  } else if (language === 'japanese') {
    // Filter out any English text that might be mixed in
    processedTranscript = transcript.map(line => {
      // Remove English text patterns - text before Japanese characters or wrapped in quotes
      let cleanedText = line.text;
      
      // Pattern 1: Remove English text followed by Japanese (e.g., "Hello, world" こんにちは世界)
      cleanedText = cleanedText.replace(/^[A-Za-z0-9\s,.!?"'-]+(?=[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF])/g, '');
      
      // Pattern 2: Remove quoted English within Japanese text
      cleanedText = cleanedText.replace(/"[^"\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+"/g, '');
      
      // Pattern 3: Remove standalone English lines (lines with no Japanese characters)
      if (!/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(cleanedText)) {
        cleanedText = '';
      }
      
      return {
        ...line,
        text: cleanedText.trim()
      };
    }).filter(line => line.text.length > 0); // Remove empty lines
  }
  // For 'both', use the transcript as-is
  
  const srtContent = generateSRT(processedTranscript);
  fs.writeFileSync(outputPath, srtContent, 'utf8');
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log(`[${new Date().toISOString()}] Subtitle burning request received`);
  
  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('Ensuring tmp directory exists...');
    ensureTmpDirectory();
    
    console.log('Parsing form data...');
    const form = formidable({
      uploadDir: path.join(process.cwd(), 'tmp'),
      keepExtensions: true,
      maxFileSize: 500 * 1024 * 1024, // 500MB
    })

    const [fields, files] = await form.parse(req)
    const videoFile = Array.isArray(files.video) ? files.video[0] : files.video
    const transcriptData = Array.isArray(fields.transcript) ? fields.transcript[0] : fields.transcript
    const languageOption = Array.isArray(fields.language) ? fields.language[0] : fields.language

    if (!videoFile || !transcriptData) {
      console.error('Missing required data:', {
        hasVideo: !!videoFile,
        hasTranscript: !!transcriptData
      });
      return res.status(400).json({ error: 'Video file and transcript are required' })
    }

    // Parse language option (default to 'japanese' for backward compatibility)
    const language = languageOption || 'japanese'
    console.log('Language option:', language);

    console.log('Video file uploaded:', {
      originalFilename: videoFile.originalFilename,
      mimetype: videoFile.mimetype,
      size: videoFile.size,
      filepath: videoFile.filepath
    });

    console.log('Parsing transcript data...');
    const transcript: TranscriptLine[] = JSON.parse(transcriptData)
    console.log('Transcript parsed, lines:', transcript.length);

    // Create temporary files
    const tempDir = path.join(process.cwd(), 'tmp')
    const srtPath = path.join(tempDir, `subtitle-${Date.now()}.srt`)
    const outputPath = path.join(tempDir, `output-${Date.now()}.mp4`)
    console.log('Temporary file paths:', { srtPath, outputPath });

    // Get video dimensions for responsive font sizing
    console.log('Probing video dimensions...');
    const probeCommand = `ffprobe -v quiet -print_format json -show_streams "${videoFile.filepath}"`
    const { stdout: probeOutput } = await execAsync(probeCommand)
    const videoInfo = JSON.parse(probeOutput)
    const videoStream = videoInfo.streams.find((s: any) => s.codec_type === 'video')
    const height = videoStream?.height || 1080
    console.log('Video dimensions:', { width: videoStream?.width, height });
    
    // Calculate font size to match editing screen preview
    // Use 1.8% of video height for consistency with text-xl (approximately 18-20px)
    const fontSize = Math.max(16, Math.round(height * 0.018))
    console.log('Calculated font size:', fontSize);
    
    // Calculate margin for positioning above playback controls (5% from bottom)
    const marginV = Math.round(height * 0.05);
    console.log('Bottom margin:', marginV);
    
    // Create SRT file from transcript
    console.log('Creating SRT file with language option:', language);
    createSRTFile(transcript, srtPath, language)
    console.log('SRT file created successfully');
    
    // FFmpeg command to burn subtitles with semi-transparent black background
    // BorderStyle=3 creates box around text, Outline creates thickness
    const ffmpegCommand = `ffmpeg -i "${videoFile.filepath}" -vf "subtitles='${srtPath}':force_style='FontName=Arial,Fontsize=${fontSize},PrimaryColour=&HFFFFFF&,OutlineColour=&H66000000&,Outline=8,Shadow=0,BackColour=&H66000000&,BorderStyle=3,Alignment=2,MarginV=${marginV}'" -c:a copy "${outputPath}"`
    console.log('FFmpeg command:', ffmpegCommand);

    // Execute FFmpeg
    console.log('Executing FFmpeg...');
    const { stdout: ffmpegOutput, stderr: ffmpegError } = await execAsync(ffmpegCommand)
    if (ffmpegError) {
      console.log('FFmpeg stderr:', ffmpegError);
    }
    if (ffmpegOutput) {
      console.log('FFmpeg stdout:', ffmpegOutput);
    }
    console.log('FFmpeg execution completed successfully');

    // Read the output file
    console.log('Reading output video file...');
    const outputVideo = fs.readFileSync(outputPath)
    console.log('Output video size:', outputVideo.length, 'bytes');

    // Clean up temporary files
    console.log('Cleaning up temporary files...');
    fs.unlinkSync(videoFile.filepath)
    fs.unlinkSync(srtPath)
    fs.unlinkSync(outputPath)
    
    // Clean up old temp files
    console.log('Cleaning up old temp files...');
    await cleanupTempFiles(path.join(process.cwd(), 'tmp'))

    // Send the processed video
    console.log(`[${new Date().toISOString()}] Video processing successful, sending response`);
    res.setHeader('Content-Type', 'video/mp4')
    res.setHeader('Content-Disposition', 'attachment; filename="subtitled-video.mp4"')
    res.send(outputVideo)

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Video processing error:`, {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
      cause: error instanceof Error ? error.cause : undefined
    });
    
    // More specific error messages
    if (error instanceof Error) {
      if (error.message.includes('ENOENT')) {
        console.error('File not found error - check if video upload completed properly');
      } else if (error.message.includes('EACCES')) {
        console.error('Permission denied error - check file/directory permissions');
      } else if (error.message.includes('ffmpeg')) {
        console.error('FFmpeg error - check if FFmpeg is installed and video format is supported');
      } else if (error.message.includes('ffprobe')) {
        console.error('FFprobe error - check if video file is valid');
      }
    }
    
    res.status(500).json({ error: 'Failed to process video' })
  }
}