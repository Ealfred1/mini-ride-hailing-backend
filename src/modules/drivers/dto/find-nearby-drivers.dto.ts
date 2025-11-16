import { ApiProperty } from '@nestjs/swagger';
import { IsLatitude, IsLongitude, IsOptional, Max, Min } from 'class-validator';

export class FindNearbyDriversDto {
  @ApiProperty({ example: 6.55 })
  @IsLatitude()
  lat: number;

  @ApiProperty({ example: 3.35 })
  @IsLongitude()
  lng: number;

  @ApiProperty({ example: 5, required: false })
  @IsOptional()
  @Min(1)
  @Max(20)
  limit?: number;
}

