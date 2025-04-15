import { Message } from 'discord.js';
import { GuildSettings } from '../models/GuildSettings';
import { rerollWinnersByMessageId } from '../utils/rerollUtils';
import { incrementStat } from '../utils/userStats';

function extractMentionedUserIds(embed: any): string[] {
  if (!embed || !embed.fields) return [];
  const winnerField = embed.fields.find((f: any) => f.name.includes("🏆"));
  if (!winnerField) return [];
  return [...winnerField.value.matchAll(/<@!?(\d+)>/g)].map(m => m[1]);
}

export async function execute(message: Message, args: string[]) {
  const guildId = message.guild?.id;
  const settings = await GuildSettings.findOne({ where: { guildId } });
  const prefix = settings?.get('prefix') || '!';

  if (args.length < 1) {
    return message.reply(`❌ Usage: \`${prefix} reroll <messageId>\` - Reroll winners for a specific giveaway message.`);
  }

  const messageId = args[0];
  const targetMessage = await message.channel.messages.fetch(messageId).catch(() => null);
  if (!targetMessage) return message.reply('❌ Could not fetch giveaway message.');

  const oldWinners = extractMentionedUserIds(targetMessage.embeds[0] ?? null);
  const newWinners = await rerollWinnersByMessageId(message.client, messageId);

  if (!newWinners.length) {
    return message.reply('❌ No eligible participants found or reroll failed.');
  }

  // 🎯 Track rerolled users
  const rerolledUsers = oldWinners.filter(id => !newWinners.includes(id));
  for (const userId of rerolledUsers) {
    await incrementStat(userId, guildId!, 'rerolled');
  }

  for (const userId of newWinners) {
    await incrementStat(userId, guildId!, 'won');
  }

  return message.reply(`🎉 **New Rerolled Winners:** ${newWinners.map(id => `<@${id}>`).join(', ')}`);
}