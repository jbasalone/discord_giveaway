import { Message, TextChannel } from 'discord.js';
import { GuildSettings } from '../models/GuildSettings';

export async function execute(message: Message, args: string[]) {
    if (!message.member?.permissions.has("Administrator")) {
        return message.reply("❌ You need Administrator permissions to set the Miniboss channel.");
    }

    const guildId = message.guild!.id;
    const channel = message.mentions.channels.first() as TextChannel;

    if (!channel) {
        return message.reply("❌ Please mention a valid text channel. Example: `!ga setminibosschannel #miniboss-events`");
    }

    try {
        // ✅ Ensure GuildSettings entry exists
        let guildSettings = await GuildSettings.findOne({ where: { guildId } });

        if (!guildSettings) {
            guildSettings = await GuildSettings.create({
                guildId,
                minibossChannelId: channel.id,
                prefix: "!ga"  // ✅ Default prefix if not set
            });
        } else {
            await guildSettings.update({ minibossChannelId: channel.id });
        }

        return message.reply(`✅ Miniboss channel set to <#${channel.id}>!`);
    } catch (error) {
        console.error("❌ Error setting Miniboss channel:", error);
        return message.reply("❌ An error occurred while setting the Miniboss channel.");
    }
}