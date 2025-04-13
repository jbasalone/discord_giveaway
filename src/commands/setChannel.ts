import { Message, PermissionsBitField, TextChannel, GuildChannel } from 'discord.js';
import { AllowedGiveawayChannels } from '../models/AllowedGiveawayChannels';
import { GuildSettings } from '../models/GuildSettings';

export async function execute(message: Message, args: string[]) {
    if (!message.guild) {
        return message.reply("❌ This command must be used inside a server.");
    }

    if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply("❌ You need **Administrator** permissions to manage allowed channels.");
    }

    const guildId = message.guild.id;
    const settings = await GuildSettings.findOne({ where: { guildId } });
    const prefix = settings?.get("prefix") || "!";
    const channel = message.mentions.channels.first() || message.channel;

    //  Ensure channel is a GuildChannel and has a name
    if (!channel || !(channel instanceof TextChannel)) {
        return message.reply("❌ Please specify a valid **text channel** for giveaways.");
    }

    if (args[0] === "add") {
        await AllowedGiveawayChannels.create({ guildId, channelId: channel.id });
        return message.reply(`✅ Added **#${channel.name}** as an allowed giveaway channel.`);
    }

    if (args[0] === "remove") {
        await AllowedGiveawayChannels.destroy({ where: { guildId, channelId: channel.id } });
        return message.reply(`✅ Removed **#${channel.name}** from allowed giveaway channels.`);
    }

    return message.reply(`❌ Usage:\n` +
        `\`\`\n ${prefix} ga setchannel add #channel\n\`\`\`\n` +
        `\`\`\`\n ${prefix} ga setchannel remove #channel\n\`\`\``);
}