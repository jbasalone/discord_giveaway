import { Message, EmbedBuilder, TextChannel } from 'discord.js';
import { SavedGiveaway } from '../models/SavedGiveaway';
import { Giveaway } from '../models/Giveaway';
import { updateGiveawayEmbed } from '../utils/updateGiveawayEmbed';

/**
 * Converts seconds into `hh:mm:ss` format for readability.
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours}h ${minutes}m ${secs}s`;
}

export async function execute(message: Message, args: string[]) {
  if (args.length < 1) {
    return message.reply("❌ You must specify a template name.");
  }

  const templateName = args[0];

  // ✅ Fetch saved giveaway template
  const template = await SavedGiveaway.findOne({
    where: { name: templateName, guildId: message.guild!.id },
  });

  if (!template) {
    return message.reply(`❌ Template **${templateName}** not found.`);
  }

  // ✅ Ensure `extraFields` is always an object
  const extraFields: Record<string, any> = template.extraFields ? JSON.parse(template.extraFields) : {};

  // ✅ Convert duration properly
  const formattedDuration = formatDuration(template.duration);

  // ✅ Create giveaway embed
  const embed = new EmbedBuilder()
      .setTitle(template.title)
      .setDescription(template.description)
      .setColor("Gold")
      .setFields([
        { name: "🎟️ Total Participants", value: "0 users", inline: true },
        { name: "🏆 Winners", value: `${template.winnerCount}`, inline: true },
        { name: "⏳ Duration", value: formattedDuration, inline: true },
        ...Object.entries(extraFields).map(([key, value]) => ({ name: key, value: String(value), inline: true })), // ✅ Fix TS7053
      ]);

  // ✅ Ensure correct channel type
  const textChannel = message.channel as TextChannel;
  const giveawayMessage = await textChannel.send({ embeds: [embed] });

  // ✅ Store giveaway details in DB
  const giveaway = await Giveaway.create({
    guildId: message.guild!.id,
    host: message.author.id,
    channelId: message.channel.id,
    messageId: giveawayMessage.id,
    title: template.title,
    description: template.description,
    role: template.role ?? undefined,  // ✅ Convert `null` to `undefined`
    duration: template.duration,
    winnerCount: template.winnerCount,
    participants: JSON.stringify([]),
    extraFields: template.extraFields ?? undefined,  // ✅ Convert `null` to `undefined`
    endsAt: Math.floor(Date.now() / 1000) + template.duration,
  });

  // ✅ Update giveaway message with interactive buttons
  await updateGiveawayEmbed(giveaway, message.client);

  await message.reply(`✅ Giveaway **${templateName}** started!`);
}