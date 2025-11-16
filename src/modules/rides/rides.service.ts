import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateRideDto } from './dto/create-ride.dto';
import { Ride } from './entities/ride.entity';
import { RideStatus } from './enums/ride-status.enum';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class RidesService {
  constructor(
    @InjectRepository(Ride)
    private readonly rideRepository: Repository<Ride>,
    private readonly queueService: QueueService,
  ) {}

  async createRide(dto: CreateRideDto) {
    const ride = this.rideRepository.create({
      userId: dto.userId,
      pickupLat: dto.pickupLat,
      pickupLng: dto.pickupLng,
      pickupAddress: dto.pickupAddress,
      destinationLat: dto.destinationLat,
      destinationLng: dto.destinationLng,
      destinationAddress: dto.destinationAddress,
      status: RideStatus.PENDING,
    });
    const saved = await this.rideRepository.save(ride);
    await this.queueService.enqueueRideAssignment(saved.id);
    return saved;
  }

  async findById(id: string) {
    const ride = await this.rideRepository.findOne({
      where: { id },
      relations: ['driver'],
    });
    if (!ride) {
      throw new NotFoundException('Ride not found');
    }
    return ride;
  }
}

