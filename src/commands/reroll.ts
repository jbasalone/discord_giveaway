import { Message } from 'discord.js';
import { GuildSettings } from '../models/GuildSettings';
import { rerollWinnersByMessageId } from '../utils/rerollUtils';

export async function execute(message: Message, args: string[]) {
  const guildId = message.guild?.id;
  const settings = await GuildSettings.findOne({ where: { guildId } });
  const prefix = settings?.get('prefix') || '!';

  if (args.length < 1) {
    return message.reply(`❌ Usage: \`${prefix} reroll <messageId>\` - Reroll winners for a specific giveaway message.`);
  }

  const messageId = args[0];
  const rerollResults = await rerollWinnersByMessageId(message.client, messageId);

  if (!rerollResults.length) {
    return message.reply('❌ No eligible participants found or reroll failed.');
  }

  return message.reply(`🎉 **New Rerolled Winners:** ${rerollResults.map(id => `<@${id}>`).join(', ')}`);
}