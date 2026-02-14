// src/services/rabbitmq-consumer.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimeseriesData } from '../entities/timeseries-data.entity';
import { ParsedTimeseriesData } from './file-parser.service';

@Injectable()
export class RabbitMQConsumerService {
  private readonly logger = new Logger(RabbitMQConsumerService.name);

  constructor(
    @InjectRepository(TimeseriesData)
    private timeseriesRepository: Repository<TimeseriesData>,
  ) {}

  @EventPattern('data.ingestion')
  async handleBatchIngestion(
    @Payload() payload: { data: ParsedTimeseriesData[]; timestamp: Date; batchSize: number },
    @Ctx() context: RmqContext,
  ): Promise<void> {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    try {
      this.logger.log(`Processing batch of ${payload.batchSize} records`);

      // Bulk insert برای بهبود performance
      const entities = payload.data.map((item) => 
        this.timeseriesRepository.create(item)
      );

      await this.timeseriesRepository
        .createQueryBuilder()
        .insert()
        .into(TimeseriesData)
        .values(entities)
        .execute();

      this.logger.log(`Successfully inserted ${payload.batchSize} records`);

      // Manual acknowledgment
      channel.ack(originalMsg);
    } catch (error) {
      this.logger.error(`Error processing batch: ${error.message}`, error.stack);
      
      // در صورت خطا، message را به queue برمی‌گردانیم
      channel.nack(originalMsg, false, true);
    }
  }

  @EventPattern('data.single')
  async handleSingleIngestion(
    @Payload() payload: { data: ParsedTimeseriesData; timestamp: Date },
    @Ctx() context: RmqContext,
  ): Promise<void> {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    try {
      const entity = this.timeseriesRepository.create(payload.data);
      await this.timeseriesRepository.save(entity);

      channel.ack(originalMsg);
    } catch (error) {
      this.logger.error(`Error processing single record: ${error.message}`);
      channel.nack(originalMsg, false, true);
    }
  }
}
