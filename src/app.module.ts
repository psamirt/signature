import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './modules/health/health.module';
import { ProductsModule } from './modules/products/products.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { AgentModule } from './modules/agent/agent.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { LegalModule } from './modules/legal/legal.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    LegalModule,
    ProductsModule,
    ConversationsModule,
    WhatsappModule,
    AgentModule,
    InventoryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
