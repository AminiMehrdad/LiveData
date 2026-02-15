// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // configure Swagger
  const config = new DocumentBuilder()
    .setTitle('Well Production API')
    .setDescription('API for time-series well production data')
    .setVersion('1.0')
    .addTag('wells')
    .addTag('production')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
  // --------------------------------------------------------

  const configService = app.get(ConfigService);
  const port = configService.get('PORT') || 3000;
  await app.listen(port);

  console.log(`🚀 HTTP Server running on: http://localhost:${port}`);
}

bootstrap();
