import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { experimental_createMCPClient as createMCPClient } from 'ai';
import { streamText, UIMessage, convertToModelMessages, stepCountIs } from 'ai';
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';

export default defineLazyEventHandler(async () => {
  const bedrock = createAmazonBedrock({
    region: 'us-east-1',
  });

  const dspClient = await createMCPClient({
    transport: new StreamableHTTPClientTransport(
      new URL('http://localhost:3067/mcp'), // change to your remote mcp url
    ),
  });

  return defineEventHandler(async (event: any) => {
    const { messages }: { messages: UIMessage[] } = await readBody(event);

    const dspClientTools = await dspClient.tools();
    const tools = {
      ...dspClientTools,
    };

    const result = streamText({
      model: bedrock('anthropic.claude-3-5-sonnet-20240620-v1:0'),
      tools,
      stopWhen: stepCountIs(5),
      messages: convertToModelMessages(messages),
    });

    return result.toUIMessageStreamResponse({
      sendSources: true
    });
  });
});