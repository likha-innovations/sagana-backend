import { Module } from '@nestjs/common';
import { FeedstocksController } from './feedstocks.controller';
import { FeedstocksService } from './feedstocks.service';

@Module({
  controllers: [FeedstocksController],
  providers: [FeedstocksService],
  exports: [FeedstocksService],
})
export class FeedstocksModule {}
