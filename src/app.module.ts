import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { DriversModule } from './modules/drivers/drivers.module';
import { QueueModule } from './modules/queue/queue.module';
import { RidesModule } from './modules/rides/rides.module';
import { databaseConfig, redisConfig } from './config/database.config';
import { SeedModule } from './database/seeds/seed.module';
import { ApiKeyGuard } from './common/guards/api-key.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, redisConfig],
    }),
    TypeOrmModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.username'),
        password: config.get<string>('database.password'),
        database: config.get<string>('database.name'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: config.get('NODE_ENV') !== 'production',
        migrationsRun: false,
      }),
      inject: [ConfigService],
    }),
    BullModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
        },
      }),
      inject: [ConfigService],
    }),
    DriversModule,
    RidesModule,
    QueueModule,
    SeedModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ApiKeyGuard,
    },
  ],
})
export class AppModule {}
