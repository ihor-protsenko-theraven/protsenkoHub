import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { CalendarModule } from './calendar/calendar.module';
import { ContactsModule } from './contacts/contacts.module';
import { PrismaModule } from './prisma/prisma.module';
import { ShoppingModule } from './shopping/shopping.module';
import { SolomiyaModule } from './solomiya/solomiya.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    CalendarModule,
    ShoppingModule,
    SolomiyaModule,
    ContactsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
