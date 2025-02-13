import { Message, PermissionsBitField, TextChannel } from "discord.js";
import { GuildSettings } from "../models/GuildSettings";

export async function execute(message: Message, args: string[]) {
    if (!message.guild) {
        return message.reply("❌ This command must be used inside a server.");
    }

    if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply("❌ You need **Administrator** permissions to set a giveaway channel.");
    }

    const botMember = message.guild.members.me;
    if (!botMember || !botMember.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
        return message.reply("❌ I don't have permission to **Manage Channels** in this server.");
    }

    const channel = message.mentions.channels.first() as TextChannel;
    if (!channel || !channel.isTextBased()) {
        return message.reply("❌ Please **mention a valid text channel**.");
    }

    try {
        await GuildSettings.upsert({
            guildId: message.guild.id,
            giveawayChannel: channel.id
        });

        return message.reply(`✅ **Giveaway channel has been set to** ${channel}.`);
    } catch (error) {
        console.error("❌ Error setting giveaway channel:", error);
        return message.reply("❌ **Failed to set the giveaway channel.** Please try again.");
    }
}