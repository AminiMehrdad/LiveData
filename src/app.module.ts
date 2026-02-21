// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductionData } from './entities/production.entitie';
import { Well } from './entities/well.entitie';
import { CsvBootstrapService } from './services/csvReader.service';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forFeature([ProductionData, Well]),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? "localhost",
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      autoLoadEntities: true,
      synchronize: true, 
      
    }),
    
    // TypeOrmModule.forFeature([ProductionData, Well]),
  ],
  controllers: [],
  providers: [CsvBootstrapService],
})
export class AppModule {}
