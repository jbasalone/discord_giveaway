import { Message, PermissionsBitField, TextChannel } from 'discord.js';
import { GuildSettings } from '../models/GuildSettings';

export async function execute(message: Message, args: string[]) {
    if (!message.guild) {
        return message.reply("❌ This command must be used inside a server.");
    }

    if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply("❌ You need **Administrator** permissions to set the Miniboss channel.");
    }

    const channel = message.mentions.channels.first() as TextChannel;
    if (!channel) {
        return message.reply("❌ Please mention a **valid text channel**. Example: `!ga setminibosschannel #miniboss-events`");
    }

    try {
        const existingSettings = await GuildSettings.findOne({ where: { guildId: message.guild.id } });

        if (existingSettings) {
            await existingSettings.update({ minibossChannelId: channel.id });
        } else {
            await GuildSettings.create({
                guildId: message.guild.id,
                minibossChannelId: channel.id
            });
        }

        return message.reply(`✅ **Miniboss channel has been set to** <#${channel.id}>!`);
    } catch (error) {
        console.error("❌ Error setting Miniboss channel:", error);
        return message.reply("❌ **An error occurred while setting the Miniboss channel.** Please try again.");
    }
}