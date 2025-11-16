import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Driver } from './entities/driver.entity';
import { FindNearbyDriversDto } from './dto/find-nearby-drivers.dto';
import { DriverStatus } from './enums/driver-status.enum';
import { Ride } from '../rides/entities/ride.entity';
import { RideStatus } from '../rides/enums/ride-status.enum';

@Injectable()
export class DriversService {
  constructor(
    @InjectRepository(Driver)
    private readonly driverRepository: Repository<Driver>,
    @InjectRepository(Ride)
    private readonly rideRepository: Repository<Ride>,
  ) {}

  findAll() {
    return this.driverRepository.find();
  }

  async findNearby(dto: FindNearbyDriversDto) {
    const limit = dto.limit ?? 5;
    const point = 'ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)';
    const result = await this.driverRepository
      .createQueryBuilder('driver')
      .where('driver.status = :status', { status: DriverStatus.AVAILABLE })
      .addSelect(
        `ST_Distance(driver.location, ${point}) / 1000`,
        'distance_km',
      )
      .orderBy(
        `driver.location <-> ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)`,
        'ASC',
      )
      .limit(limit)
      .setParameters({ lat: dto.lat, lng: dto.lng })
      .getRawAndEntities();

    return result.entities.map((entity, index) => ({
      ...entity,
      distanceKm: Number(result.raw[index].distance_km ?? 0),
    }));
  }

  async acceptRide(driverId: string, rideId: string) {
    const driver = await this.driverRepository.findOne({ where: { id: driverId } });
    if (!driver) {
      throw new NotFoundException('Driver not found');
    }
    const ride = await this.rideRepository.findOne({ where: { id: rideId } });
    if (!ride) {
      throw new NotFoundException('Ride not found');
    }
    if (ride.driverId && ride.driverId !== driverId) {
      throw new BadRequestException('Ride already assigned to another driver');
    }
    if (ride.status !== RideStatus.ASSIGNED && ride.status !== RideStatus.PENDING) {
      throw new BadRequestException('Ride cannot be accepted');
    }
    await this.rideRepository.update(rideId, {
      status: RideStatus.ACCEPTED,
      driverId,
    });
    await this.driverRepository.update(driverId, {
      status: DriverStatus.BUSY,
    });
    return this.rideRepository.findOne({
      where: { id: rideId },
      relations: ['driver'],
    });
  }
}

