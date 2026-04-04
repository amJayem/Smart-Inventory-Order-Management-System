import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('activity')
export class ActivityController {
  constructor(private activityService: ActivityService) {}

  @Get()
  findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    return this.activityService.findAll(+page, +limit);
  }

  @Get('recent')
  getRecent(@Query('limit') limit = '10') {
    return this.activityService.getRecent(+limit);
  }
}
