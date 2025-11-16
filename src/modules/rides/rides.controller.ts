import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RidesService } from './rides.service';
import { CreateRideDto } from './dto/create-ride.dto';

@ApiTags('Rides')
@Controller('rides')
export class RidesController {
  constructor(private readonly ridesService: RidesService) {}

  @Post()
  @ApiOperation({ summary: 'Create ride request' })
  @ApiCreatedResponse({ description: 'Ride created and queued for assignment' })
  createRide(@Body() body: CreateRideDto) {
    return this.ridesService.createRide(body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get ride details' })
  @ApiOkResponse({ description: 'Ride details retrieved' })
  getRide(@Param('id') id: string) {
    return this.ridesService.findById(id);
  }
}

