const path = require('node:path');

module.exports = {
  apps: [
    {
      name: 'cloud-storage-api',
      cwd: __dirname,
      script: 'dist/main.js',
      interpreter: 'node',
      instances: 1,
      autorestart: true,
      max_memory_restart: '750M',
      kill_timeout: 10000,
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
    {
      name: 'cloud-storage-web',
      cwd: path.join(__dirname, 'frontend'),
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3001',
      interpreter: 'node',
      instances: 1,
      autorestart: true,
      max_memory_restart: '500M',
      kill_timeout: 10000,
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
    },
  ],
};
