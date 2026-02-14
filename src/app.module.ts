// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { TimeseriesData } from './entities/timeseries-data.entity';
import { FileParserService } from './services/file-parser.service';
import { RabbitMQProducerService } from './services/rabbitmq-producer.service';
import { RabbitMQConsumerService } from './services/rabbitmq-consumer.service';
import { TimeseriesQueryService } from './services/timeseries-query.service';
import { TimeseriesController } from './controllers/timeseries.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: configService.get('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_DATABASE'),
        entities: [TimeseriesData],
        synchronize: false, // استفاده از migrations
        logging: true,
        extra: {
          // بهینه‌سازی برای TimescaleDB
          max: 20,
          connectionTimeoutMillis: 5000,
        },
      }),
    }),
    TypeOrmModule.forFeature([TimeseriesData]),
    MulterModule.register({
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
      },
    }),
  ],
  controllers: [TimeseriesController],
  providers: [
    FileParserService,
    RabbitMQProducerService,
    RabbitMQConsumerService,
    TimeseriesQueryService,
  ],
})
export class AppModule {}
