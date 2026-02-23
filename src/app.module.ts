import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';  // ← این import
import { ProductionData } from './entities/production.entitie';
import { Well } from './entities/well.entitie';
import { CsvBootstrapService } from './services/csvReader.service';
import { RedisModule } from './Redis/redis.module';
import { SenderService } from './services/sender.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST') ?? 'localhost',
        port: configService.get<number>('DB_PORT') ?? 5432,
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),
        autoLoadEntities: true,
        synchronize: true,
      }),
      inject: [ConfigService],
    }),

    TypeOrmModule.forFeature([ProductionData, Well]),

    // ← اینجا RabbitMQModule رو درست initialize کن
    RabbitMQModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        exchanges: [
          {
            name: 'production_data_exchange',
            type: 'topic',
          },
        ],
        uri: configService.get<string>('RABBITMQ_URL') 
             ?? 'amqp://admin:admin123@localhost:5672',
        connectionInitOptions: { 
          wait: true,       // ← صبر کن تا connection برقرار بشه
          timeout: 20000,   // ← 20 ثانیه timeout
        },
      }),
      inject: [ConfigService],
    }),

    RedisModule,
  ],
  controllers: [],
  providers: [
    CsvBootstrapService,
    SenderService,
    // ← AmqpConnection رو از اینجا حذف کن! RabbitMQModule خودش export میکنه
  ],
})
export class AppModule {}
