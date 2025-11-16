import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Driver } from '../../drivers/entities/driver.entity';
import { RideStatus } from '../enums/ride-status.enum';

@Entity({ name: 'rides' })
export class Ride {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'varchar', length: 120 })
  @Index()
  userId: string;

  @Column({ name: 'pickup_lat', type: 'decimal', precision: 10, scale: 7 })
  pickupLat: number;

  @Column({ name: 'pickup_lng', type: 'decimal', precision: 10, scale: 7 })
  pickupLng: number;

  @Column({ name: 'pickup_address', type: 'varchar', length: 255 })
  pickupAddress: string;

  @Column({ name: 'destination_lat', type: 'decimal', precision: 10, scale: 7 })
  destinationLat: number;

  @Column({ name: 'destination_lng', type: 'decimal', precision: 10, scale: 7 })
  destinationLng: number;

  @Column({ name: 'destination_address', type: 'varchar', length: 255 })
  destinationAddress: string;

  @Column({
    type: 'enum',
    enum: RideStatus,
    default: RideStatus.PENDING,
  })
  @Index()
  status: RideStatus;

  @Column({ name: 'driver_id', type: 'uuid', nullable: true })
  driverId?: string | null;

  @ManyToOne(() => Driver, (driver) => driver.rides, { nullable: true })
  @JoinColumn({ name: 'driver_id' })
  driver?: Driver | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

