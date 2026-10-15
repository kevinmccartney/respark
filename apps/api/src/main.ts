import { existsSync } from 'fs';
import { dirname, resolve } from 'path';

import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import { config } from 'dotenv';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';

// Repo-root .env.local. Walk up because src/ and dist/src/ sit at different depths.
let repoRoot = __dirname;
while (repoRoot !== dirname(repoRoot) && !existsSync(resolve(repoRoot, 'package-lock.json'))) {
  repoRoot = dirname(repoRoot);
}
const envLocal = resolve(repoRoot, '.env.local');
if (existsSync(envLocal)) {
  config({ path: envLocal, override: true });
}

const bootstrap = async () => {
  // rawBody keeps the exact bytes Clerk signed available for webhook verification.
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });
  app.useWebSocketAdapter(new WsAdapter(app));
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  app.enableCors({
    origin: true,
    methods: ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type'],
  });
  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, '0.0.0.0');

  const logger = app.get(Logger);
  logger.log(
    {
      event: 'server.started',
      port,
      nodeEnv: process.env.NODE_ENV ?? 'development',
      logLevel: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    },
    'API listening',
  );
};

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
