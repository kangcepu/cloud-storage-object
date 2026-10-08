const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { DatabaseService } = require('../dist/common/database.service');
const { ObjectStorageService } = require('../dist/storage/object-storage.service');
const { SettingsService } = require('../dist/settings/settings.service');

let context;

before(async () => {
  context = await NestFactory.createApplicationContext(AppModule, { logger: false });
});

after(async () => {
  await context.close();
});

test('database connection uses the existing schema', async () => {
  const database = context.get(DatabaseService);
  await database.ping();
  const rows = await database.query('SELECT COUNT(*) count FROM users');
  assert.ok(Number(rows[0].count) > 0);
});

test('encrypted MinIO settings remain readable', async () => {
  const settings = context.get(SettingsService);
  assert.equal(await settings.hasMinioConfig(), true);
});

test('MinIO connection lists the existing buckets', async () => {
  const storage = context.get(ObjectStorageService);
  const buckets = await storage.listBuckets();
  assert.ok(buckets.length > 0);
});
