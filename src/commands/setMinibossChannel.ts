import { Message, PermissionsBitField, TextChannel } from 'discord.js';
import { GuildSettings } from '../models/GuildSettings';

export async function execute(message: Message, args: string[]) {
    if (!message.guild) {
        return message.reply("❌ This command must be used inside a server.");
    }

    if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply("❌ You need **Administrator** permissions to set the Miniboss channel.");
    }

    const guildId = message.guild?.id;
    const settings = await GuildSettings.findOne({ where: { guildId } });
    const prefix = settings?.get("prefix") || "!";

    // ✅ **Fix: Ensure Proper Channel Detection**
    if (args.length < 1 || !message.mentions.channels.first()) {
        return message.reply(`❌ **Invalid command!** Example:\n\`\`\`\n ${prefix} ga setmbch #miniboss-events\n\`\`\``);
    }

    const channel = message.mentions.channels.first() as TextChannel;


    try {
        // ✅ **Check if the GuildSettings entry exists**
        const [settings, created] = await GuildSettings.findOrCreate({
            where: { guildId },
            defaults: { minibossChannelId: channel.id }
        });

        // ✅ **Update if it already exists**
        if (!created) {
            await settings.update({ minibossChannelId: channel.id });
        }

        return message.reply(`✅ **Miniboss channel successfully set to** <#${channel.id}>!`);
    } catch (error) {
        console.error("❌ Error setting Miniboss channel:", error);
        return message.reply("❌ **An error occurred while setting the Miniboss channel.** Please try again.");
    }
}