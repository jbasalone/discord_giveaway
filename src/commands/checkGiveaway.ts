import { Message, EmbedBuilder, TextChannel } from 'discord.js';
import { Giveaway } from '../models/Giveaway';
import { startLiveCountdown } from '../utils/giveawayTimer';

export async function executeCheckGiveaway(message: Message) {
    try {
        const activeGiveaways = await Giveaway.findAll({
            where: { endsAt: { $gt: Date.now() } }
        });

        if (activeGiveaways.length === 0) {
            return message.reply("⚠️ No active giveaways found.");
        }

        let response = "**🎉 Active Giveaways:**\n";
        for (const giveaway of activeGiveaways) {
            const timeLeft = Math.floor((giveaway.endsAt - Date.now()) / 1000);
            response += `📢 **${giveaway.title}** - Ends in ${timeLeft}s - [Go to Giveaway](https://discord.com/channels/${message.guildId}/${giveaway.channelId}/${giveaway.messageId})\n`;
        }

        await message.reply(response);
    } catch (error) {
        console.error("❌ Error checking giveaways:", error);
        await message.reply("❌ Unable to retrieve giveaways.");
    }
}