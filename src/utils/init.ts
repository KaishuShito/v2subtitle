import fs from 'fs';
import path from 'path';

export function ensureTmpDirectory(): void {
  const tmpDir = path.join(process.cwd(), 'tmp');
  
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
    console.log('Created tmp directory');
  }
}