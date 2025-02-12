import { Message, EmbedBuilder } from 'discord.js';
import { SavedGiveaway } from '../models/SavedGiveaway';

export async function execute(message: Message) {
  const templates = await SavedGiveaway.findAll({ where: { guildId: message.guild!.id } });

  if (templates.length === 0) {
    return message.reply("❌ No saved giveaway templates found.");
  }

  const embed = new EmbedBuilder()
      .setTitle('📜 Saved Giveaway Templates')
      .setColor('Blue');

  templates.forEach((template: SavedGiveaway) => { // ✅ Explicitly define type
    embed.addFields([
      { name: template.getDataValue('name'), value: `🏆 **Winners**: ${template.winnerCount}, ⏳ **Duration**: ${template.duration / 60000}m` }
    ]);
  });

  message.reply({ embeds: [embed] });
}