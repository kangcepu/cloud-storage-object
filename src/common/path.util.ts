import { BadRequestException } from '@nestjs/common';

export function safeObjectKey(value: string): string {
  let key = value
    .replaceAll('\\', '/')
    .replace(/\/{2,}/g, '/')
    .replace(/^\/+/, '');
  const trailingSlash = key.endsWith('/');
  key = key.replace(/\/+$/, '');
  if (!key || key.includes('\0')) {
    throw new BadRequestException('Invalid object key.');
  }
  const parts = key.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) {
    throw new BadRequestException('Invalid object key.');
  }
  return trailingSlash ? `${key}/` : key;
}

export function sanitizeClientPath(value: string): string {
  const normalized = value
    .replaceAll('\\', '/')
    .replace(/\/{2,}/g, '/')
    .replace(/^\/+/, '')
    .trim();
  if (!normalized || normalized.includes('\0')) {
    throw new BadRequestException('Invalid file path.');
  }
  const parts = normalized.split('/').filter(Boolean);
  return parts
    .map((part) => {
      const trimmed = part.trim();
      if (!trimmed || trimmed === '.' || trimmed === '..') {
        throw new BadRequestException('Invalid file path.');
      }
      return trimmed.replace(/[^\p{L}\p{N}_.\- ]/gu, '_').trim() || 'file';
    })
    .join('/');
}

export function ensureFolderKey(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}

export function slugBucket(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
