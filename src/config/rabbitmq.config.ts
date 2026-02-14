// src/config/rabbitmq.config.ts
import { Transport, RmqOptions } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';

export const getRabbitMQConfig = (configService: ConfigService): RmqOptions => {
  return {
    transport: Transport.RMQ,
    options: {
      urls: [configService.get<string>('RABBITMQ_URL')!],
      queue: configService.get<string>('RABBITMQ_QUEUE_DATA_INGESTION'),
      queueOptions: {
        durable: true, // حفظ queue در صورت restart
        arguments: {
          'x-message-ttl': 86400000, // TTL: 24 hours
          'x-max-length': 100000, // حداکثر تعداد message
        },
      },
      prefetchCount: 10, // تعداد message برای هر consumer
      noAck: false, // manual acknowledgment
    },
  };
};
