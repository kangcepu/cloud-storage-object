import { BadRequestException, Injectable } from '@nestjs/common';
import { createReadStream, createWriteStream, existsSync, promises as fs } from 'node:fs';
import { basename, dirname, extname, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { StoragePathService } from '../common/storage-path.service';
import { ObjectStorageService } from '../storage/object-storage.service';

@Injectable()
export class RawPreviewService {
  private readonly pending = new Map<string, Promise<string>>();
  private readonly extensions = new Set([
    'cr2',
    'cr3',
    'nef',
    'arw',
    'dng',
    'raf',
    'rw2',
    'orf',
    'srw',
    'pef',
    '3fr',
    'sr2',
    'mrw',
  ]);
  private readonly rasterExtensions = new Set([
    'jpg',
    'jpeg',
    'png',
    'webp',
    'tif',
    'tiff',
    'bmp',
    'avif',
    'heic',
    'heif',
  ]);

  constructor(
    private readonly storage: ObjectStorageService,
    private readonly paths: StoragePathService,
  ) {}

  isRaw(key: string): boolean {
    return this.extensions.has(extname(key).slice(1).toLowerCase());
  }

  isRaster(key: string): boolean {
    return this.rasterExtensions.has(extname(key).slice(1).toLowerCase());
  }

  thumbKey(key: string): string {
    return `__thumbs/${key.replaceAll('\\', '/').replace(/^\/+/, '')}.webp`;
  }

  previewKey(key: string): string {
    return `__previews/${key.replaceAll('\\', '/').replace(/^\/+/, '')}.jpg`;
  }

  async ensureThumb(bucket: string, key: string): Promise<string> {
    return this.ensure(bucket, key, this.thumbKey(key), 480, 'webp');
  }

  async ensurePreview(bucket: string, key: string): Promise<string> {
    return this.ensure(bucket, key, this.previewKey(key), 2048, 'jpg');
  }

  private async ensure(
    bucket: string,
    key: string,
    derivedKey: string,
    size: number,
    format: string,
  ): Promise<string> {
    const pendingKey = `${bucket}:${derivedKey}`;
    const pending = this.pending.get(pendingKey);
    if (pending) return pending;
    const task = this.generate(bucket, key, derivedKey, size, format).finally(() => {
      if (this.pending.get(pendingKey) === task) this.pending.delete(pendingKey);
    });
    this.pending.set(pendingKey, task);
    return task;
  }

  private async generate(
    bucket: string,
    key: string,
    derivedKey: string,
    size: number,
    format: string,
  ): Promise<string> {
    const [sourceStat, derivedStat] = await Promise.all([
      this.storage.statObject(bucket, key),
      this.storage.statObject(bucket, derivedKey),
    ]);
    if (
      derivedStat.exists &&
      (!sourceStat.lastModified ||
        !derivedStat.lastModified ||
        derivedStat.lastModified >= sourceStat.lastModified)
    ) {
      return derivedKey;
    }
    const suffix = randomBytes(8).toString('hex');
    const source = this.paths.current('tmp', `raw_${suffix}${extname(key) || '.raw'}`);
    const output = this.paths.current('tmp', `preview_${suffix}.${format}`);
    try {
      const object = await this.storage.objectStream(bucket, key);
      await pipeline(object.stream, createWriteStream(source));
      await this.convert(source, output, size);
      const outputStat = await fs.stat(output);
      await this.storage.putObject(
        bucket,
        derivedKey,
        createReadStream(output),
        format === 'webp' ? 'image/webp' : 'image/jpeg',
        outputStat.size,
      );
      return derivedKey;
    } finally {
      await Promise.all([fs.rm(source, { force: true }), fs.rm(output, { force: true })]);
    }
  }

  private async convert(source: string, output: string, size: number): Promise<void> {
    const quality = size <= 600 ? '78' : '82';
    try {
      await this.imageMagickConvert(source, output, `${size}x${size}>`, quality);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(`RAW convert gagal: ${message || basename(source)}`);
    }
  }

  private async imageMagickConvert(
    source: string,
    output: string,
    resize: string,
    quality: string,
  ): Promise<void> {
    const command = this.imageMagickBinary();
    const input = await this.imageMagickInput(source);
    const processHandle = spawn(
      command,
      [
        '-limit',
        'memory',
        '512MiB',
        '-limit',
        'map',
        '1GiB',
        '-limit',
        'disk',
        '2GiB',
        '-limit',
        'thread',
        '2',
        input,
        '-auto-orient',
        '-thumbnail',
        resize,
        '-strip',
        '-quality',
        quality,
        output,
      ],
      {
        stdio: ['ignore', 'ignore', 'pipe'],
        windowsHide: true,
        env: {
          ...process.env,
          MAGICK_CONFIGURE_PATH: this.imageMagickConfigDirectory(),
          MAGICK_TEMPORARY_PATH: dirname(output),
        },
      },
    );
    const errors: Buffer[] = [];
    processHandle.stderr.on('data', (value: Buffer) => errors.push(value));
    const code = await this.waitProcess(processHandle, command);
    if (code !== 0) {
      throw new Error(Buffer.concat(errors).toString('utf8').trim().slice(0, 500) || `Exit code ${code}`);
    }
    const stat = await fs.stat(output).catch(() => null);
    if (!stat?.size) {
      throw new Error(Buffer.concat(errors).toString('utf8').slice(0, 500) || 'Output kosong.');
    }
  }

  private async imageMagickInput(source: string): Promise<string> {
    const handle = await fs.open(source, 'r');
    const header = Buffer.alloc(16);
    try {
      await handle.read(header, 0, header.length, 0);
    } finally {
      await handle.close();
    }
    let format = '';
    if (header.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) format = 'JPEG';
    else if (header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
      format = 'PNG';
    else if (header.subarray(0, 6).toString('ascii').startsWith('GIF8')) format = 'GIF';
    else if (
      header.subarray(0, 4).toString('ascii') === 'RIFF' &&
      header.subarray(8, 12).toString('ascii') === 'WEBP'
    )
      format = 'WEBP';
    return `${format ? `${format}:` : ''}${source}[0]`;
  }

  private imageMagickDirectory(): string {
    return resolve(__dirname, '..', '..', 'tools', 'imagemagick-portable');
  }

  private imageMagickConfigDirectory(): string {
    return resolve(__dirname, '..', '..', 'tools', 'imagemagick-config');
  }

  private imageMagickBinary(): string {
    const configured = process.env.IMAGE_MAGICK_BIN?.trim();
    if (configured) {
      return configured;
    }
    const bundled = resolve(
      this.imageMagickDirectory(),
      process.platform === 'win32' ? 'magick.exe' : 'magick',
    );
    if (existsSync(bundled)) {
      return bundled;
    }
    return process.platform === 'win32' ? 'magick.exe' : 'magick';
  }

  private waitProcess(processHandle: ReturnType<typeof spawn>, command: string): Promise<number> {
    return new Promise((resolve, reject) => {
      let finished = false;
      const complete = (error: Error | null, code = -1) => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        if (error) reject(error);
        else resolve(code);
      };
      const timeout = setTimeout(() => {
        processHandle.kill();
        complete(new Error('Konversi melewati batas waktu 120 detik.'));
      }, 120_000);
      processHandle.once('error', (error) => complete(new Error(`${command}: ${error.message}`)));
      processHandle.once('close', (code) => complete(null, code ?? -1));
    });
  }
}
