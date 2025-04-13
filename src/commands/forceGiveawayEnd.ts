import { Message, TextChannel, EmbedBuilder } from 'discord.js';
import { Giveaway } from '../models/Giveaway';
import { handleGiveawayEnd } from '../events/giveawayEnd';
import { cache } from '../utils/giveawayCache';

export const name = 'end';
export const description = 'Forcefully ends a giveaway immediately using the message ID.';
export const usage = 'ga end <messageId>';
export const permissions = ['MANAGE_MESSAGES'];

export async function execute(message: Message, args: string[]) {
    try {
        if (!args[0]) {
            return sendEphemeralReply(message, `⚠️ You must provide a **message ID**. Usage: \`${usage}\``);
        }

        const messageId = args[0];

        let giveaway = await Giveaway.findOne({ where: { messageId } });

        if (!giveaway) {
            return sendEphemeralReply(message, `⚠️ No giveaway found with message ID **${messageId}**.`);
        }

        const giveawayId = giveaway.get('id');

        const channel = message.guild?.channels.cache.get(giveaway.get('channelId')) as TextChannel;
        if (!channel) {
            return sendEphemeralReply(message, `❌ Giveaway channel not found.`);
        }

        // ✅ **Set `endsAt` to 0 and remove from cache to force reprocessing**
        await giveaway.update({ endsAt: 0 });

        cache.del(`giveaway-processing-${giveawayId}`);
        console.log(`✅ [DEBUG] Manually ending giveaway ${giveawayId}, ensuring it's unlocked.`);
        await handleGiveawayEnd(message.client, giveawayId);

        cache.del(`miniboss-running-${giveawayId}`);

        return sendEphemeralReply(message, `✅ Successfully force-ended the giveaway with message ID **${messageId}**.`);
    } catch (error) {
        console.error("❌ Error in `forceGiveawayEnd.ts`:", error);
        return sendEphemeralReply(message, `❌ An error occurred while trying to force end the giveaway.`);
    }
}

/**
 * Sends an ephemeral-like reply (auto-deletes after a short delay).
 */
async function sendEphemeralReply(message: Message, content: string) {
    try {
        const reply = await message.reply({ content });
        setTimeout(() => reply.delete().catch(() => {}), 5000); // Deletes after 5 seconds
    } catch (error) {
        console.error("❌ Failed to send ephemeral message:", error);
    }
}