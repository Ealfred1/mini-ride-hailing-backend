import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueueService } from './queue.service';
import { QueueProcessor } from './queue.processor';
import { RIDE_ASSIGNMENT_QUEUE } from './constants/queue.constants';
import { Ride } from '../rides/entities/ride.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Ride, Driver]),
    BullModule.registerQueueAsync({
      name: RIDE_ASSIGNMENT_QUEUE,
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: Number(config.get('REDIS_PORT', 6379)),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [QueueService, QueueProcessor],
  exports: [QueueService],
})
export class QueueModule {}

