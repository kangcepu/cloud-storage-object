const assert = require('node:assert/strict');
const { test } = require('node:test');
const { ConfigService } = require('@nestjs/config');
const { CryptoService } = require('../dist/common/crypto.service');
const { ensureFolderKey, safeObjectKey, sanitizeClientPath, slugBucket } = require('../dist/common/path.util');
const { RawPreviewService } = require('../dist/raw/raw-preview.service');

test('crypto encrypts and decrypts PHP-compatible payload layout', () => {
  const config = new ConfigService({
    APP_ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 7).toString('base64'),
    APP_ENCRYPTION_AAD: 'enterprise-s3-storage-manager',
  });
  const crypto = new CryptoService(config);
  const encrypted = crypto.encrypt('secret-value');
  assert.ok(Buffer.from(encrypted, 'base64').length > 28);
  assert.equal(crypto.decrypt(encrypted), 'secret-value');
});

test('object paths are normalized and traversal is rejected', () => {
  assert.equal(safeObjectKey('folder\\file.txt'), 'folder/file.txt');
  assert.equal(ensureFolderKey('folder'), 'folder/');
  assert.throws(() => safeObjectKey('../secret'));
});

test('client paths and bucket names are sanitized deterministically', () => {
  assert.equal(sanitizeClientPath('folder/a:b?.txt'), 'folder/a_b_.txt');
  assert.equal(slugBucket(' Project Storage '), 'project-storage');
});

test('RAW converter accepts an explicit cross-platform ImageMagick runtime', () => {
  const previousBinary = process.env.IMAGE_MAGICK_BIN;
  const previousConfig = process.env.IMAGE_MAGICK_CONFIG_PATH;
  try {
    process.env.IMAGE_MAGICK_BIN = '/opt/imagemagick/bin/magick';
    process.env.IMAGE_MAGICK_CONFIG_PATH = '/opt/imagemagick/etc/ImageMagick-7';
    const raw = new RawPreviewService({}, {});
    assert.deepEqual(raw.imageMagickRuntime(), {
      command: '/opt/imagemagick/bin/magick',
      configurePath: '/opt/imagemagick/etc/ImageMagick-7',
    });
  } finally {
    if (previousBinary === undefined) delete process.env.IMAGE_MAGICK_BIN;
    else process.env.IMAGE_MAGICK_BIN = previousBinary;
    if (previousConfig === undefined) delete process.env.IMAGE_MAGICK_CONFIG_PATH;
    else process.env.IMAGE_MAGICK_CONFIG_PATH = previousConfig;
  }
});
