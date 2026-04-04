import { Controller, Get, Delete, Param, Query, UseGuards } from '@nestjs/common';
import { RestockService } from './restock.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('restock')
export class RestockController {
  constructor(private restockService: RestockService) {}

  @Get()
  findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    return this.restockService.findAll(+page, +limit);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.restockService.remove(id);
  }
}
