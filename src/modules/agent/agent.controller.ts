import { Body, Controller, Post } from '@nestjs/common';
import { AgentService, type AgentResult } from './agent.service';
import { SendMessageDto } from '../../common/dto/message.dto';

@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  /** Prueba el bot sin pasar por WhatsApp. No persiste nada. */
  @Post('message')
  handleMessage(@Body() body: SendMessageDto): Promise<AgentResult> {
    return this.agentService.handleMessage(body.message);
  }
}
