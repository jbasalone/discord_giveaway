import { Message, TextChannel, EmbedBuilder } from 'discord.js';
import { Giveaway } from '../models/Giveaway';
import { getGiveaway } from '../utils/getGiveaway';

export async function execute(message: Message, args: string[]) {
    try {
        if (!message.member?.permissions.has("ManageMessages")) {
            return message.reply("❌ You need `Manage Messages` permission to edit a giveaway.");
        }

        if (args.length < 2) {
            return message.reply("❌ Usage: `!ga edit <giveawayID> <newTitle>` - Update a giveaway.");
        }

        const giveawayId = args[0];
        const newTitle = args.slice(1).join(" ");

        // ✅ Ensure we fetch a full model instance
        let giveaway = await Giveaway.findOne({ where: { id: giveawayId } });

        if (!giveaway) {
            return message.reply("❌ Giveaway not found.");
        }

        // ✅ Update title in database
        giveaway.title = newTitle;
        await giveaway.save();

        // ✅ Ensure Message ID Exists
        if (!giveaway.messageId || !giveaway.channelId) {
            console.error(`❌ Missing messageId or channelId for giveaway ID: ${giveawayId}`);
            return message.reply("❌ Error updating giveaway: Missing Discord message.");
        }

        // ✅ Fetch Channel & Message
        const channel = message.client.channels.cache.get(giveaway.channelId) as TextChannel;
        if (!channel) {
            return message.reply("❌ Could not find the giveaway channel.");
        }

        let giveawayMessage;
        try {
            giveawayMessage = await channel.messages.fetch(giveaway.messageId);
        } catch (error) {
            console.error(`❌ Error fetching giveaway message:`, error);
            return message.reply("❌ Failed to update the giveaway message.");
        }

        // ✅ Update Embed
        const embed = EmbedBuilder.from(giveawayMessage.embeds[0]);
        embed.setTitle(newTitle);

        await giveawayMessage.edit({ embeds: [embed] });

        return message.reply(`✅ Giveaway **${newTitle}** has been updated.`);
    } catch (error) {
        console.error("❌ Error editing giveaway:", error);
        return message.reply("❌ An error occurred while editing the giveaway.");
    }
}