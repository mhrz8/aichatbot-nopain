import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { LanceDB }from "@langchain/community/vectorstores/lancedb";
import { connect } from '@lancedb/lancedb';
import { BedrockEmbeddings } from "@langchain/aws";
import { formatDocumentsAsString } from "langchain/util/document";

import { experimental_createMCPClient as createMCPClient } from 'ai';
import { streamText, UIMessage, convertToModelMessages, stepCountIs } from 'ai';
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { PREDEFINED_SYSTEM_PROMPT } from '../shared/prompts/predefined';

const S3_BUCKET_NAME = process.env['S3_BUCKET_NAME'];
const DATABASE_NAME = process.env['DATABASE_NAME'];
const TABLE_NAME = process.env['TABLE_NAME'];

const AGENT_MODEL = 'anthropic.claude-3-5-sonnet-20240620-v1:0';
const EMBEDDING_MODEL = 'amazon.titan-embed-text-v2:0';

async function retrieveKnowledgeFromDB(query: string): Promise<string> {
  let context = '';

  if (!S3_BUCKET_NAME || !DATABASE_NAME || !TABLE_NAME) {
    console.error('Unknown Vector DB configuration');
    return context;
  }

  try {
    const db = await connect(`s3://${S3_BUCKET_NAME}/embeddings/${DATABASE_NAME}`);
    const table = await db.openTable(TABLE_NAME);

    const embeddings = new BedrockEmbeddings({ model: EMBEDDING_MODEL });
    const vectorStore = new LanceDB(embeddings, { table });
    const retriever = vectorStore.asRetriever();

      const docs = await retriever.invoke(query);
      context = formatDocumentsAsString(docs);
  } catch (error) {
    console.error('Failed retrieving the context');
  }

  return context;
}

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
    const processedMessages = [...messages];
    const lastMessageIndex = processedMessages.length - 1;
    const lastMessage = processedMessages[lastMessageIndex];
    const lastMessagePart = lastMessage.parts[0];

    let context = '';
    if (lastMessagePart.type === 'text') {
      context = await retrieveKnowledgeFromDB(lastMessagePart.text)
    }

    // Step 1. List of available tools from MCP Server(s)
    const dspClientTools = await dspClient.tools();
    const tools = { ...dspClientTools };

    // Step 2. Build system prompt
    let systemPrompt = `
You are a helpful AI assistant that answers using **provided context** and **available tools**.
## Available MCP servers and their capabilities:
`;
    for (const [name, tool] of Object.entries(tools)) {
      systemPrompt += `  - ${name}: ${tool.description}\n`;
    }
    systemPrompt += PREDEFINED_SYSTEM_PROMPT;

    // Step 3. Append context to user's message when available
    if (context.trim() && lastMessagePart.type === 'text') {
      const enhancedMessage: UIMessage = {
        ...lastMessage,
        parts: [{
          ...lastMessagePart,
          text: `${lastMessagePart.text}
---
**Relevant Context:**
${context}
---
Answer using the above context when relevant.`
        }]
      };
      
      processedMessages[lastMessageIndex] = enhancedMessage;
    }

    const result = streamText({
      model: bedrock(AGENT_MODEL),
      tools,
      stopWhen: stepCountIs(5),
      system: systemPrompt,
      messages: convertToModelMessages(processedMessages),
    });

    return result.toUIMessageStreamResponse({
      sendSources: true
    });
  });
});