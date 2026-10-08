import { diskStorage } from 'multer';
import { randomBytes } from 'node:crypto';
import { extname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

export function uploadStorage() {
  const directory = join(process.env.STORAGE_PATH || join(process.cwd(), 'storage'), 'tmp');
  mkdirSync(directory, { recursive: true });
  return diskStorage({
    destination: directory,
    filename: (_request, file, callback) => {
      callback(null, `${randomBytes(16).toString('hex')}${extname(file.originalname).toLowerCase()}`);
    },
  });
}
