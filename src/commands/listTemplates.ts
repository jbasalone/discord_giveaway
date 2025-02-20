import { Message, EmbedBuilder, Colors } from 'discord.js';
import { SavedGiveaway } from '../models/SavedGiveaway';

export async function execute(message: Message) {
  if (!message.guild) {
    return message.reply("❌ This command must be used inside a server.");
  }

  try {
    const guildId = message.guild.id;
    const templates = await SavedGiveaway.findAll({ where: { guildId } });

    if (templates.length === 0) {
      return message.reply("❌ No saved giveaway templates found.");
    }

    // ✅ Create an Embed for Saved Templates
    const embed = new EmbedBuilder()
        .setTitle("📜 Saved Giveaway Templates")
        .setColor(Colors.Blue);

    // ✅ Loop through templates and retrieve values safely using `.get()`
    templates.forEach((template) => {
      const id = template.get("id") ?? "N/A"; // ✅ Display ID separately
      const name = template.get("name") ?? "Unknown";
      const type = String(template.get("type") || "custom").toLowerCase(); //
      const isMiniboss = type === "miniboss";
      const winnerCount = Number(template.get("winnerCount") || 1); //
      const forceMode = Boolean(template.get("forceStart")); //

      const durationMs = template.get("duration") ?? 0;
      const durationSeconds = Math.floor(durationMs / 1000);
      const durationFormatted = durationSeconds >= 60
          ? `${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s`
          : `${durationSeconds}s`;


      let extraFields;
      try {
        extraFields = JSON.parse(template.get("extraFields") ?? "{}");
      } catch (error) {
        console.error(`❌ Error parsing extraFields for ${name}:`, error);
        extraFields = {};
      }

      const formattedFields = Object.entries(extraFields)
          .map(([key, value]) => `**${key}**: ${value}`)
          .join("\n");

      // ✅ **Build Giveaway Information**
      let giveawayInfo = `🆔 **ID**: ${id}\n🏆 **Winners**: ${winnerCount}\n⏳ **Duration**: ${durationFormatted}\n📝 **Type**: ${type.toUpperCase()}`;

      if (isMiniboss) {
        giveawayInfo += `\n🔥 **Forced Mode**: ${forceMode ? "Enabled ✅" : "Disabled ❌"}`;
      }

      if (formattedFields) {
        giveawayInfo += `\n📋 **Fields**:\n${formattedFields}`;
      }

      embed.addFields({ name: `🎁 ${name}`, value: giveawayInfo, inline: false });
    });

    await message.reply({ embeds: [embed] });
  } catch (error) {
    console.error("❌ Error listing saved templates:", error);
    return message.reply("❌ Failed to retrieve saved templates.");
  }
}