import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Driver } from '../../modules/drivers/entities/driver.entity';
import { DriverStatus } from '../../modules/drivers/enums/driver-status.enum';
import type { Point } from 'geojson';

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(Driver)
    private readonly driverRepository: Repository<Driver>,
  ) {}

  async run() {
    this.logger.log('Starting seed...');
    await this.driverRepository.query(
      `TRUNCATE TABLE "rides","drivers" RESTART IDENTITY CASCADE`,
    );
    const drivers: Driver[] = Array.from({ length: 20 }).map((_, index) => {
      const lat = 6.5 + Math.random() * 0.1;
      const lng = 3.3 + Math.random() * 0.1;
      const location: Point = {
        type: 'Point',
        coordinates: [lng, lat],
      };
      return this.driverRepository.create({
        name: `Driver ${index + 1}`,
        status: Math.random() > 0.5 ? DriverStatus.AVAILABLE : DriverStatus.BUSY,
        location,
      });
    });
    await this.driverRepository.save(drivers);
    this.logger.log('Seeding completed');
  }
}

