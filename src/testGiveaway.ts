import { Client, TextChannel, EmbedBuilder, Message } from 'discord.js';
import { startLiveCountdown } from './utils/giveawayTimer';

const mockClient = new Client({
    intents: [],
}) as Client<true>; // ✅ Ensure it's a "fully cached" Client instance

const mockChannel = {
    id: '123456789012345678',
    send: async () => ({ id: '987654321098765432' }),
} as unknown as TextChannel;

const mockMessage = {
    id: '987654321098765432',
    channel: mockChannel,
    edit: async () => {},
    embeds: [new EmbedBuilder().setTitle('Test Giveaway').toJSON()],
} as unknown as Message<true>; // ✅ Explicitly set type to Message<true>

export async function runTest() {
    console.log("🚀 Running Giveaway Countdown Test...");
    await startLiveCountdown(1, mockClient);
}