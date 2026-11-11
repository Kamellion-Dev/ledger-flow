import amqp, { type AmqpConnectionManager, type ChannelWrapper } from 'amqp-connection-manager';
import type { Channel } from 'amqplib';
import type { EventPublisher } from './outbox-dispatcher.js';
import type { OutboxRecord } from '../ledger/ledger-repository.js';

const EXCHANGE = 'ledgerflow.events';

export class RabbitMqEventPublisher implements EventPublisher {
  private readonly connection: AmqpConnectionManager;
  private readonly channel: ChannelWrapper;

  constructor(url: string) {
    this.connection = amqp.connect([url]);
    this.channel = this.connection.createChannel({
      setup: async (channel: Channel) => {
        await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
      },
    });
  }

  async publish(record: OutboxRecord): Promise<void> {
    await this.channel.publish(
      EXCHANGE,
      record.eventName,
      Buffer.from(JSON.stringify(record.event)),
      {
        persistent: true,
        contentType: 'application/json',
        messageId: record.id,
        correlationId: record.correlationId,
        timestamp: Date.now(),
      },
    );
  }

  async close(): Promise<void> {
    await this.channel.close();
    await this.connection.close();
  }
}
