import { Module } from '@nestjs/common';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { WhatsappApiService } from './whatsapp-api.service';
import { AgentModule } from '../agent/agent.module';
import { ConversationsModule } from '../conversations/conversations.module';

@Module({
  imports: [AgentModule, ConversationsModule],
  controllers: [WhatsappController],
  providers: [WhatsappService, WhatsappApiService],
  exports: [WhatsappService, WhatsappApiService],
})
export class WhatsappModule {}
