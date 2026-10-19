import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthUser } from '../common/types';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';
import { SolomiyaService } from './solomiya.service';

@Controller('solomiya/tasks')
@UseGuards(JwtAuthGuard)
export class SolomiyaController {
  constructor(private readonly solomiyaService: SolomiyaService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('status') status?: TaskStatus) {
    return this.solomiyaService.list(user, status);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTaskDto) {
    return this.solomiyaService.create(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.solomiyaService.update(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.solomiyaService.remove(user, id);
  }
}
