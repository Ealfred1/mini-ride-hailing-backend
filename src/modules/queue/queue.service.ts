import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bull';
import { RIDE_ASSIGNMENT_QUEUE } from './constants/queue.constants';

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue(RIDE_ASSIGNMENT_QUEUE)
    private readonly rideQueue: Queue,
  ) {}

  async enqueueRideAssignment(rideId: string) {
    await this.rideQueue.add(
      'assign',
      { rideId },
      {
        attempts: 2,
        backoff: {
          type: 'fixed',
          delay: 10000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }
}

