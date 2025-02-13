import { Message, EmbedBuilder } from 'discord.js';
import { SavedGiveaway } from '../models/SavedGiveaway';

export async function execute(message: Message) {
  try {
    const templates = await SavedGiveaway.findAll({
      where: { guildId: message.guild!.id },
      attributes: ['name', 'winnerCount', 'duration'], // ✅ Fetch only necessary fields
      raw: true, // ✅ Ensures correct structure
    });

    if (templates.length === 0) {
      const emptyEmbed = new EmbedBuilder()
          .setTitle("📜 Saved Giveaway Templates")
          .setColor("Blue")
          .setDescription("❌ No saved giveaway templates found.");
      return message.reply({ embeds: [emptyEmbed] });
    }

    const embed = new EmbedBuilder()
        .setTitle("📜 Saved Giveaway Templates")
        .setColor("Blue");

    templates.slice(0, 25).forEach(template => { // ✅ Limit to 25 fields (Discord limit)
      embed.addFields([
        {
          name: `🎁 ${template.name}`,
          value: `🏆 **Winners**: ${template.winnerCount}\n⏳ **Duration**: ${template.duration / 60}s`,
          inline: true
        }
      ]);
    });

    await message.reply({ embeds: [embed] });
  } catch (error) {
    console.error("❌ Error listing giveaway templates:", error);
    return message.reply("❌ Failed to list giveaway templates. Please try again.");
  }
}