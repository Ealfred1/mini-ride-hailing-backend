import { ApiProperty } from '@nestjs/swagger';
import {
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateRideDto {
  @ApiProperty({ example: 'user_123' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ example: 6.534 })
  @IsLatitude()
  pickupLat: number;

  @ApiProperty({ example: 3.378 })
  @IsLongitude()
  pickupLng: number;

  @ApiProperty({ example: 'Lekki Phase 1' })
  @IsString()
  @MaxLength(255)
  pickupAddress: string;

  @ApiProperty({ example: 6.572 })
  @IsLatitude()
  destinationLat: number;

  @ApiProperty({ example: 3.321 })
  @IsLongitude()
  destinationLng: number;

  @ApiProperty({ example: 'Victoria Island' })
  @IsString()
  @MaxLength(255)
  destinationAddress: string;
}

