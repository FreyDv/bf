import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './configure-app.js';

// bufferLogs: what Nest logs before configureApp installs the pino logger is kept and written through it, as JSON.
const app = await NestFactory.create(AppModule, { bufferLogs: true });
configureApp(app);
await app.listen(Number(process.env['PORT'] ?? 3000));
