// src/services/rabbitmq-producer.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import { ParsedTimeseriesData } from './file-parser.service';

@Injectable()
export class RabbitMQProducerService implements OnModuleInit, OnModuleDestroy {
  private client: ClientProxy;

  constructor(private configService: ConfigService) {
    this.client = ClientProxyFactory.create({
      transport: Transport.RMQ,
      options: {
        urls: [this.configService.get<string>('RABBITMQ_URL') || 'amqp://localhost'],
        queue: this.configService.get<string>('RABBITMQ_QUEUE_DATA_INGESTION'),
        queueOptions: {
          durable: true,
        },
      },
    } as any);
  }

  async onModuleInit() {
    await this.client.connect();
  }

  async onModuleDestroy() {
    await this.client.close();
  }

  async sendDataBatch(data: ParsedTimeseriesData[], batchSize = 1000): Promise<void> {
    // تقسیم داده به batch‌های کوچک‌تر برای بهبود performance
    const batches = this.chunkArray(data, batchSize);

    for (const batch of batches) {
      await this.client
        .emit('data.ingestion', {
          data: batch,
          timestamp: new Date(),
          batchSize: batch.length,
        })
        .toPromise();
    }
  }

  async sendSingleData(data: ParsedTimeseriesData): Promise<void> {
    await this.client
      .emit('data.single', {
        data,
        timestamp: new Date(),
      })
      .toPromise();
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
