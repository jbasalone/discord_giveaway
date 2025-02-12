import { Message } from "discord.js";
import { GuildSettings } from "../models/GuildSettings";

export async function execute(message: Message, args: string[]) {
    if (!message.member?.permissions.has("Administrator")) {
        return message.reply("❌ You need Administrator permissions to set a giveaway channel.");
    }

    const channel = message.mentions.channels.first();
    if (!channel) {
        return message.reply("❌ Please mention a valid channel. Example: `!ga setchannel #giveaways`");
    }

    const guildId = message.guild!.id;

    try {
        // ✅ Update or Insert Channel into GuildSettings
        await GuildSettings.upsert({
            guildId: guildId,
            giveawayChannel: channel.id
        });

        return message.reply(`✅ Giveaway channel has been set to ${channel}.`);
    } catch (error) {
        console.error("❌ Error setting giveaway channel:", error);
        return message.reply("❌ Failed to set giveaway channel. Please try again.");
    }
}