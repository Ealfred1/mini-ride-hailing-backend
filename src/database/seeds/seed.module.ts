import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Driver } from '../../modules/drivers/entities/driver.entity';
import { SeedService } from './seed.service';

@Module({
  imports: [TypeOrmModule.forFeature([Driver])],
  providers: [SeedService],
  exports: [SeedService],
})
export class SeedModule {}

