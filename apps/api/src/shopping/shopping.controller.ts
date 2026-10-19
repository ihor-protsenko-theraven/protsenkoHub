import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthUser } from '../common/types';
import {
  CreateShoppingItemDto,
  UpdateShoppingItemDto,
} from './dto/shopping.dto';
import { ShoppingService } from './shopping.service';

@Controller('shopping/items')
@UseGuards(JwtAuthGuard)
export class ShoppingController {
  constructor(private readonly shoppingService: ShoppingService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.shoppingService.listItems(user);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateShoppingItemDto) {
    return this.shoppingService.createItem(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateShoppingItemDto,
  ) {
    return this.shoppingService.updateItem(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.shoppingService.removeItem(user, id);
  }
}
