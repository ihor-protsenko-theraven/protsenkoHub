import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthUser } from '../common/types';
import { CreateShoppingListDto } from './dto/shopping.dto';
import { ShoppingService } from './shopping.service';

@Controller('shopping/lists')
@UseGuards(JwtAuthGuard)
export class ShoppingListsController {
  constructor(private readonly shopping: ShoppingService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.shopping.listLists(user);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateShoppingListDto) {
    return this.shopping.createList(user, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.shopping.removeList(user, id);
  }
}
