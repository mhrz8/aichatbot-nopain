<script setup lang="ts">
import { Chat } from "@ai-sdk/vue";
import { DefaultChatTransport } from "ai";
import { Input } from "@/components/ui/input";

const input = ref("");
const chat = new Chat({
    transport: new DefaultChatTransport({
        api: '/api/chat'
    })
});

// watch(() => chat.messages, (messages) => {
//     console.log('All messages:', messages);
//     messages.forEach((msg, idx) => {
//         console.log(`Message ${idx}:`, msg);
//         msg.parts.forEach((part, partIdx) => {
//             console.log(`  Part ${partIdx} (${part.type}):`, part);
//         });
//     });
// }, { deep: true });

const handleSubmit = () => {
    chat.sendMessage({ text: input.value });
    input.value = "";
};
</script>

<template>
    <div class="p-5">
        <div v-for="(m, messageIdx) in chat.messages" :key="m.id ? m.id : messageIdx">
            {{ m.role === "user" ? "User: " : "AI: " }}
            <div
                v-for="(part, partIdx) in m.parts"
                :key="`${m.id}-${part.type}-${partIdx}`"
            >
                <div v-if="part.type === 'text'">{{ part.text }}</div>
                <div v-if="part.type === 'dynamic-tool'">
                    <span>Calling tool: </span><pre style="display: inline;">{{ part.toolName }}</pre>
                    <pre>{{ JSON.stringify(part.input, null, 2) }}</pre>
                </div>
            </div>
        </div>

        <form @submit.prevent="handleSubmit">
            <Input v-model="input" placeholder="Say something..." />
        </form>
    </div>
</template>