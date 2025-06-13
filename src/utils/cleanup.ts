import fs from 'fs';
import path from 'path';

export async function cleanupTempFiles(tmpDir: string, maxAgeMs: number = 3600000): Promise<void> {
  try {
    const files = await fs.promises.readdir(tmpDir);
    const now = Date.now();
    
    for (const file of files) {
      const filePath = path.join(tmpDir, file);
      try {
        const stats = await fs.promises.stat(filePath);
        if (now - stats.mtimeMs > maxAgeMs) {
          await fs.promises.unlink(filePath);
          console.log(`Cleaned up old temp file: ${file}`);
        }
      } catch (error) {
        console.error(`Error cleaning up file ${file}:`, error);
      }
    }
  } catch (error) {
    console.error('Error during temp file cleanup:', error);
  }
}