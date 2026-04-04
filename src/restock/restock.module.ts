import { Module } from '@nestjs/common';
import { RestockController } from './restock.controller';
import { RestockService } from './restock.service';

@Module({
  controllers: [RestockController],
  providers: [RestockService],
})
export class RestockModule {}
