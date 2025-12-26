// Connector exports
export { GitHubConnector } from './github';
export { ClaudeConnector } from './claude';
export { GeminiConnector } from './gemini';
export { OpenAIConnector } from './openai';
export { WebhookConnector } from './webhook';

// Base connector interface
export interface Connector {
  name: string;
  type: string;
  isConnected(): boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

// Connector factory
export function createConnector(type: string, config: Record<string, unknown>): Connector {
  switch (type) {
    case 'github':
      return new (require('./github').GitHubConnector)(config);
    case 'claude':
      return new (require('./claude').ClaudeConnector)(config);
    case 'gemini':
      return new (require('./gemini').GeminiConnector)(config);
    case 'openai':
      return new (require('./openai').OpenAIConnector)(config);
    case 'webhook':
      return new (require('./webhook').WebhookConnector)(config);
    default:
      throw new Error(`Unknown connector type: ${type}`);
  }
}
