import { Module } from '@nestjs/common';
import { BarangaysService } from './barangays.service';
import { BarangaysController } from './barangays.controller';

@Module({
  providers: [BarangaysService],
  controllers: [BarangaysController],
})
export class BarangaysModule {}
