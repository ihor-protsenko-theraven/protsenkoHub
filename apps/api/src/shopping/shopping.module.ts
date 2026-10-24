import { Module } from '@nestjs/common';
import { ShoppingController } from './shopping.controller';
import { ShoppingService } from './shopping.service';
import { ShoppingListsController } from './shopping-lists.controller';

@Module({
  controllers: [ShoppingController, ShoppingListsController],
  providers: [ShoppingService],
})
export class ShoppingModule {}
