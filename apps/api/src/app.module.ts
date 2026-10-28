import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { CalendarModule } from './calendar/calendar.module';
import { ContactsModule } from './contacts/contacts.module';
import { PrismaModule } from './prisma/prisma.module';
import { ShoppingModule } from './shopping/shopping.module';
import { ChildrenModule } from './children/children.module';
import { HealthController } from './health.controller';
import { FeedingModule } from './feeding/feeding.module';
import { HomeModule } from './home/home.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    CalendarModule,
    ShoppingModule,
    ChildrenModule,
    ContactsModule,
    FeedingModule,
    HomeModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
