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

    // Create SRT file from transcript
    console.log('Creating SRT file with language option:', language);
    createSRTFile(transcript, srtPath, language)
    console.log('SRT file created successfully');

    // Get video dimensions for responsive font sizing
    console.log('Probing video dimensions...');
    const probeCommand = `ffprobe -v quiet -print_format json -show_streams "${videoFile.filepath}"`
    const { stdout: probeOutput } = await execAsync(probeCommand)
    const videoInfo = JSON.parse(probeOutput)
    const videoStream = videoInfo.streams.find((s: any) => s.codec_type === 'video')
    const height = videoStream?.height || 1080
    console.log('Video dimensions:', { width: videoStream?.width, height });
    
    // Calculate font size - reduced by 15% from original 3%
    // Use 2.55% of video height (3% * 0.85) for smaller text
    const fontSize = Math.max(14, Math.round(height * 0.0255))
    console.log('Calculated font size:', fontSize);
    
    // FFmpeg command to burn subtitles with Japanese font settings
    const ffmpegCommand = `ffmpeg -i "${videoFile.filepath}" -vf "subtitles='${srtPath}':force_style='FontName=Hiragino Kaku Gothic ProN,Fontsize=${fontSize},PrimaryColour=&HFFFFFF&,OutlineColour=&H000000&,Outline=2,BackColour=&H000000&,Shadow=1,Alignment=2,MarginV=${Math.round(height * 0.08)},Spacing=0'" -c:a copy "${outputPath}"`
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