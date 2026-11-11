import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import amqp, { type AmqpConnectionManager, type ChannelWrapper } from 'amqp-connection-manager';
import type { Channel, ConsumeMessage } from 'amqplib';
import { Redis } from 'ioredis';
import type {
  LedgerEvent,
  SettlementCompletedData,
  TransferPostedData,
} from '@ledgerflow/contracts';
import { LedgerEventName } from '@ledgerflow/contracts';
import { RedisReplayStore } from './redis-replay.store.js';
import { SettlementProcessor, type SettlementEventPublisher } from './settlement-processor.js';

const EXCHANGE = 'ledgerflow.events';
const QUEUE = 'ledgerflow.settlement.transfer-posted';

@Injectable()
export class WorkerRuntime implements OnModuleInit, OnModuleDestroy, SettlementEventPublisher {
  private connection?: AmqpConnectionManager;
  private channel?: ChannelWrapper;
  private redis?: Redis;
  private processor?: SettlementProcessor;

  onModuleInit(): void {
    const rabbitUrl = process.env.RABBITMQ_URL;
    const redisUrl = process.env.REDIS_URL;
    if (!rabbitUrl || !redisUrl) {
      throw new Error('RABBITMQ_URL and REDIS_URL are required');
    }

    this.redis = new Redis(redisUrl, { maxRetriesPerRequest: 3, lazyConnect: false });
    this.processor = new SettlementProcessor(
      new RedisReplayStore(this.redis),
      this,
      () => new Date(),
    );
    this.connection = amqp.connect([rabbitUrl]);
    this.channel = this.connection.createChannel({
      setup: async (channel: Channel) => {
        await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
        await channel.assertQueue(QUEUE, { durable: true });
        await channel.bindQueue(QUEUE, EXCHANGE, LedgerEventName.TransferPosted);
        await channel.prefetch(10);
        await channel.consume(QUEUE, (message) => this.consume(channel, message), { noAck: false });
      },
    });
  }

  async publish(event: LedgerEvent<SettlementCompletedData>): Promise<void> {
    if (!this.channel) throw new Error('Settlement worker channel is not ready');
    await this.channel.publish(EXCHANGE, event.eventName, Buffer.from(JSON.stringify(event)), {
      persistent: true,
      contentType: 'application/json',
      messageId: event.eventId,
      correlationId: event.correlationId,
      timestamp: Date.now(),
    });
  }

  private consume(channel: Channel, message: ConsumeMessage | null): void {
    if (!message) return;
    void this.process(channel, message);
  }

  private async process(channel: Channel, message: ConsumeMessage): Promise<void> {
    try {
      if (!this.processor) throw new Error('Settlement processor is not ready');
      const event = JSON.parse(message.content.toString('utf8')) as LedgerEvent<TransferPostedData>;
      await this.processor.process(event, () => channel.ack(message));
    } catch (error) {
      console.error('Settlement processing failed', error);
      channel.nack(message, false, true);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
    await this.redis?.quit();
  }
}
