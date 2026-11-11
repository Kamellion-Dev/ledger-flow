import { Module } from '@nestjs/common';
import { WorkerRuntime } from './worker-runtime.js';

@Module({ providers: [WorkerRuntime] })
export class AppModule {}
