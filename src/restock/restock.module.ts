import { Module } from '@nestjs/common';
import { RestockController } from './restock.controller';
import { RestockService } from './restock.service';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [ActivityModule],
  controllers: [RestockController],
  providers: [RestockService],
})
export class RestockModule {}
