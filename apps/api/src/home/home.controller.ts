import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthUser } from '../common/types';
import { HomeService } from './home.service';

@Controller('home')
export class HomeController {
  constructor(private readonly home: HomeService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  snapshot(@CurrentUser() user: AuthUser, @Query('preview') preview?: string) {
    return preview === '1' ? this.home.preview(user) : this.home.snapshot(user);
  }
}
