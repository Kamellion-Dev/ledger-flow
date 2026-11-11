import amqp, { type AmqpConnectionManager, type ChannelWrapper } from 'amqp-connection-manager';
import type { Channel, ConsumeMessage } from 'amqplib';
import type { LedgerEvent, SettlementCompletedData } from '@ledgerflow/contracts';
import { LedgerEventName } from '@ledgerflow/contracts';
import type { SettlementResultHandler } from './settlement-result.handler.js';

const EXCHANGE = 'ledgerflow.events';
const QUEUE = 'ledgerflow.ledger.settlement-results';

export class RabbitMqSettlementConsumer {
  private readonly connection: AmqpConnectionManager;
  private readonly channel: ChannelWrapper;

  constructor(
    url: string,
    private readonly handler: SettlementResultHandler,
  ) {
    this.connection = amqp.connect([url]);
    this.channel = this.connection.createChannel({
      setup: async (channel: Channel) => {
        await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
        await channel.assertQueue(QUEUE, { durable: true });
        await channel.bindQueue(QUEUE, EXCHANGE, LedgerEventName.SettlementCompleted);
        await channel.prefetch(10);
        await channel.consume(QUEUE, (message) => this.consume(channel, message), { noAck: false });
      },
    });
  }

  private consume(channel: Channel, message: ConsumeMessage | null): void {
    if (!message) return;
    void this.process(channel, message);
  }

  private async process(channel: Channel, message: ConsumeMessage): Promise<void> {
    try {
      const event = JSON.parse(
        message.content.toString('utf8'),
      ) as LedgerEvent<SettlementCompletedData>;
      await this.handler.handle(event, () => channel.ack(message));
    } catch (error) {
      console.error('Settlement result processing failed', error);
      channel.nack(message, false, true);
    }
  }

  async close(): Promise<void> {
    await this.channel.close();
    await this.connection.close();
  }
}
