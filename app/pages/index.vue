<script setup lang="ts">
import { Chat } from "@ai-sdk/vue";
import { DefaultChatTransport, type UIDataTypes, type UIMessagePart, type UITools } from "ai";

import {
    Conversation,
    ConversationContent,
} from '@/components/ai-elements/conversation'
import {
    PromptInput,
    PromptInputSubmit,
    PromptInputTextarea,
} from '@/components/ai-elements/prompt-input';
import { Message, MessageContent } from '@/components/ai-elements/message'
import { Response } from '@/components/ai-elements/response';
import { Thinking } from '@/components/custom/thinking';

const input = ref("");
const chat = new Chat({
    transport: new DefaultChatTransport({
        api: '/api/chat'
    })
});

const handleSubmit = () => {
    chat.sendMessage({ text: input.value });
    input.value = "";
};

function formatPart(part: UIMessagePart<UIDataTypes, UITools>): string | undefined {
    if (part.type === 'text') {
        return part.text
    } else if (part.type === 'dynamic-tool') {
        return `**Calling tool:** \`${part.toolName}\`\n\n` +
            '```json\n' +
            `${JSON.stringify(part.input, null, 2)}\n` +
            '```'
    }
}
</script>

<template>
    <div class="min-h-screen w-full flex items-center justify-center">
        <div class="max-w-4xl mx-auto p-6 relative size-full rounded-lg border h-[800px] flex flex-col">
            <div class="flex-1 overflow-y-auto">
                <Conversation>
                    <ConversationContent>
                        <Message
                            v-for="m in chat.messages"
                            :key="m.id"
                            :from="m.role"
                        >
                            <MessageContent>
                                <Response
                                    v-for="(part, partIdx) in m.parts"
                                    :key="`${m.id}-${part.type}-${partIdx}`"
                                    :content="formatPart(part)"
                                />
                            </MessageContent>
                        </Message>
                        <Thinking v-if="chat.status === 'submitted'" />
                    </ConversationContent>
                </Conversation>
            </div>

            <div class="mt-4 w-full max-w-2xl mx-auto relative">
                <PromptInput @submit.prevent="handleSubmit">
                    <PromptInputTextarea
                        v-model="input"
                        placeholder="Say something..."
                        autofocus=""
                    />
                    <PromptInputSubmit 
                        :status="chat.status === 'streaming' ? 'streaming' : 'ready'"
                        :disabled="!input.trim()"
                        class="absolute bottom-1 right-1"
                    />
                </PromptInput>
            </div>
        </div>
    </div>
</template>
