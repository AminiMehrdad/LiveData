// src/main.ts
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const rabbit = process.env.RABBITMQ_URL || 'amqp://localhost:5672';

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.RMQ,
    options: {
      urls: [rabbit],
      queue: 'production_queue',
      queueOptions: {
        durable: false,
      },
    },
  });

  await app.listen();
  console.log('Rabbit consumer microservice listening (production_queue)');

  bootstrap().catch((err) => {
    console.error('Microservice bootstrap error', err);
    process.exit(1);
  });
}

bootstrap();
