import {
    Message,
    TextChannel,
    PermissionsBitField,
    CollectorFilter,
    MessageReaction,
    User,
} from 'discord.js';
import { Giveaway } from '../models/Giveaway';

export async function execute(message: Message, args: string[]) {
    const guildId = message.guild?.id;
    if (!guildId) return;

    if (args.length < 1) {
        return message.reply(`❌ Usage: cancel <messageId> - Cancel and delete a giveaway.`);
    }

    const messageId = args[0];
    const giveaway = await Giveaway.findOne({ where: { messageId } });

    if (!giveaway) {
        return message.reply(`❌ Giveaway with message ID \`${messageId}\` not found.`);
    }

    const hostId = giveaway.get("host") as string;
    const member = await message.guild?.members.fetch(message.author.id).catch(() => null);
    const isAdmin = member?.permissions.has(PermissionsBitField.Flags.ManageMessages);

    if (message.author.id !== hostId && !isAdmin) {
        return message.reply("⛔ You do not have permission to cancel this giveaway.");
    }

    const confirmMsg = await message.reply(
        `⚠️ Are you sure you want to cancel giveaway \`${messageId}\`? React with ✅ within 20 seconds to confirm.`
    );

    try {
        await confirmMsg.react('✅');
    } catch (err) {
        console.error("Failed to react for confirmation:", err);
    }

    const filter: CollectorFilter<[MessageReaction, User]> = (reaction, user) =>
        reaction.emoji.name === '✅' && user.id === message.author.id;

    const collected = await confirmMsg
        .awaitReactions({ filter, max: 1, time: 20000, errors: ['time'] })
        .catch(() => null);

    if (!collected?.size) {
        return message.reply("❌ Giveaway cancel request timed out. No changes made.");
    }

    const guild = message.client.guilds.cache.get(giveaway.get("guildId"));
    if (!guild) {
        await Giveaway.destroy({ where: { messageId } });
        return message.reply(`⚠️ Giveaway removed from DB, but guild no longer exists.`);
    }

    const channel = guild.channels.cache.get(giveaway.get("channelId")) as TextChannel;
    if (!channel) {
        await Giveaway.destroy({ where: { messageId } });
        return message.reply(`⚠️ Giveaway removed from DB, but channel no longer exists.`);
    }

    const giveawayMessage = await channel.messages.fetch(messageId).catch(() => null);

    if (giveawayMessage) {
        try {
            await giveawayMessage.delete();
        } catch {
            await message.reply(`⚠️ Could not delete the giveaway message. Check my permissions.`);
        }
    }

    await Giveaway.destroy({ where: { messageId } });

    const logChannel = message.guild?.channels.cache.find(
        ch => ch.name.includes("giveaway-log") && ch.isTextBased()
    ) as TextChannel;

    if (logChannel) {
        await logChannel.send(`🗑️ Giveaway \`${messageId}\` was cancelled by <@${message.author.id}>`);
    }

    return message.reply(`✅ Giveaway \`${messageId}\` has been successfully cancelled.`);
}