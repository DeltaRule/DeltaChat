import type ChatService from '../services/ChatService';
import type KnowledgeService from '../services/KnowledgeService';
import type WebhookService from '../services/WebhookService';
import type McpService from '../services/McpService';

declare global {
  namespace Express {
    interface Request {
      services: {
        chatService: ChatService;
        knowledgeService: KnowledgeService;
        webhookService: WebhookService;
        mcpService: McpService;
      };
    }
  }
}
