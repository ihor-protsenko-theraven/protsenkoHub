import { Module } from '@nestjs/common';
import { CalendarModule } from '../calendar/calendar.module';
import { ChildrenModule } from '../children/children.module';
import { FeedingModule } from '../feeding/feeding.module';
import { ShoppingModule } from '../shopping/shopping.module';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';

@Module({
  imports: [CalendarModule, ChildrenModule, ShoppingModule, FeedingModule],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
