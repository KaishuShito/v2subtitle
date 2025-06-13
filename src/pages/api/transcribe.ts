import type { NextApiRequest, NextApiResponse } from 'next'
import formidable from 'formidable'
import fs from 'fs'
import path from 'path'
import { transcribeLongAudio } from '@/lib/gemini'
import { TranscribeResponse } from '@/types'
import { cleanupTempFiles } from '@/utils/cleanup'
import { ensureTmpDirectory } from '@/utils/init'

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log(`[${new Date().toISOString()}] Transcription request received`);
  
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
      maxFileSize: 200 * 1024 * 1024, // 200MB
    })

    const [, files] = await form.parse(req)
    const file = Array.isArray(files.file) ? files.file[0] : files.file

    if (!file) {
      console.error('No file uploaded in request');
      return res.status(400).json({ error: 'No file uploaded' })
    }

    console.log('File uploaded:', {
      originalFilename: file.originalFilename,
      mimetype: file.mimetype,
      size: file.size,
      filepath: file.filepath
    });

    console.log('Starting transcription with Gemini API (chunked)...');
    const transcript = await transcribeLongAudio(file.filepath, file.mimetype || 'audio/mp3')
    console.log('Transcription completed, lines:', transcript.length);

    // Clean up temporary file
    console.log('Cleaning up temporary file:', file.filepath);
    fs.unlinkSync(file.filepath)
    
    // Clean up old temp files
    console.log('Cleaning up old temp files...');
    await cleanupTempFiles(path.join(process.cwd(), 'tmp'))

    const response: TranscribeResponse = { transcript };
    console.log(`[${new Date().toISOString()}] Transcription successful`);
    res.status(200).json(response)
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Transcription error:`, {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
      cause: error instanceof Error ? error.cause : undefined
    });
    
    // More specific error messages
    if (error instanceof Error) {
      if (error.message.includes('ENOENT')) {
        console.error('File not found error - check if file upload completed properly');
      } else if (error.message.includes('EACCES')) {
        console.error('Permission denied error - check file/directory permissions');
      } else if (error.message.includes('API')) {
        console.error('API error - check Gemini API configuration and quota');
      }
    }
    
    res.status(500).json({ error: 'Failed to transcribe audio' })
  }
}