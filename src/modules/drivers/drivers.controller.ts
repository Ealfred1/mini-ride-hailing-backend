import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { DriversService } from './drivers.service';
import { FindNearbyDriversDto } from './dto/find-nearby-drivers.dto';

@ApiTags('Drivers')
@Controller('drivers')
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Get()
  @ApiOperation({ summary: 'List drivers' })
  @ApiOkResponse({ description: 'List of drivers' })
  listDrivers() {
    return this.driversService.findAll();
  }

  @Get('nearby')
  @ApiOperation({ summary: 'Find nearby available drivers' })
  @ApiOkResponse({ description: 'Nearest drivers ordered by distance' })
  findNearby(@Query() query: FindNearbyDriversDto) {
    return this.driversService.findNearby(query);
  }

  @Post(':driverId/accept/:rideId')
  @ApiOperation({ summary: 'Driver accepts ride' })
  @ApiParam({ name: 'driverId', description: 'Driver identifier' })
  @ApiParam({ name: 'rideId', description: 'Ride identifier' })
  acceptRide(@Param('driverId') driverId: string, @Param('rideId') rideId: string) {
    return this.driversService.acceptRide(driverId, rideId);
  }
}

