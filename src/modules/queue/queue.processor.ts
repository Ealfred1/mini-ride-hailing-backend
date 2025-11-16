import { OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { RIDE_ASSIGNMENT_QUEUE } from './constants/queue.constants';
import { Ride } from '../rides/entities/ride.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { DriverStatus } from '../drivers/enums/driver-status.enum';
import { RideStatus } from '../rides/enums/ride-status.enum';

@Processor(RIDE_ASSIGNMENT_QUEUE)
export class QueueProcessor {
  private readonly logger = new Logger(QueueProcessor.name);

  constructor(
    @InjectRepository(Ride)
    private readonly rideRepository: Repository<Ride>,
    @InjectRepository(Driver)
    private readonly driverRepository: Repository<Driver>,
    private readonly dataSource: DataSource,
  ) {}

  @Process('assign')
  async handleRideAssignment(job: Job<{ rideId: string }>) {
    const ride = await this.rideRepository.findOne({
      where: { id: job.data.rideId },
    });
    if (!ride) {
      this.logger.warn(`Ride ${job.data.rideId} not found`);
      return;
    }
    if (ride.status !== RideStatus.PENDING) {
      this.logger.log(`Ride ${ride.id} already processed`);
      return;
    }

    const driver = await this.findNearestAvailableDriver(ride.pickupLat, ride.pickupLng);
    if (!driver) {
      this.logger.warn(`No available drivers for ride ${ride.id}`);
      throw new Error('No available drivers');
    }

    await this.dataSource.transaction(async (manager) => {
      await manager
        .createQueryBuilder()
        .update(Ride)
        .set({
          driverId: driver.id,
          status: RideStatus.ASSIGNED,
        })
        .where('id = :id', { id: ride.id })
        .execute();

      await manager
        .createQueryBuilder()
        .update(Driver)
        .set({ status: DriverStatus.BUSY })
        .where('id = :id', { id: driver.id })
        .execute();
    });

    this.logger.log(`Assigned driver ${driver.id} to ride ${ride.id}`);
  }

  private async findNearestAvailableDriver(lat: number, lng: number) {
    return this.driverRepository
      .createQueryBuilder('driver')
      .where('driver.status = :status', { status: DriverStatus.AVAILABLE })
      .orderBy(
        `driver.location <-> ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)`,
        'ASC',
      )
      .limit(1)
      .setParameters({ lat, lng })
      .getOne();
  }

  @OnQueueFailed()
  async handleFailed(job: Job<{ rideId: string }>, error: Error) {
    const rideId = job.data?.rideId;
    if (!rideId) {
      return;
    }
    if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
      await this.rideRepository.update(rideId, {
        status: RideStatus.PENDING,
        driverId: null,
      });
      this.logger.error(
        `Ride ${rideId} assignment failed after retries: ${error.message}`,
      );
    }
  }
}

