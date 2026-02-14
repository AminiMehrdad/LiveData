// src/main.ts
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { getRabbitMQConfig } from './config/rabbitmq.config';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  // ایجاد HTTP application
  const app = await NestFactory.create(AppModule);
  
  const configService = app.get(ConfigService);

  // فعال‌سازی CORS
  app.enableCors();

  // Validation pipe
  app.useGlobalPipes(new ValidationPipe());

  // اتصال RabbitMQ microservice
  app.connectMicroservice<MicroserviceOptions>(
    getRabbitMQConfig(configService)
  );

  await app.startAllMicroservices();
  
  const port = configService.get('PORT') || 3000;
  await app.listen(port);
  
  console.log(`🚀 HTTP Server running on: http://localhost:${port}`);
  console.log(`🐰 RabbitMQ Consumer connected`);
}

bootstrap();
