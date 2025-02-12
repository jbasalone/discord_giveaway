import { ButtonInteraction, EmbedBuilder, TextChannel } from 'discord.js';
import { Giveaway } from '../models/Giveaway';

export async function executeJoinLeave(interaction: ButtonInteraction) {
  try {
    if (!interaction.customId.startsWith("join-") && !interaction.customId.startsWith("leave-")) return;

    const isJoining = interaction.customId.startsWith("join-");
    const userId = interaction.user.id;
    const giveawayId = interaction.customId.split("-")[1];

    if (!giveawayId) {
      return interaction.reply({ content: "❌ Invalid giveaway data. Please try again.", ephemeral: true });
    }

    let giveaway = await Giveaway.findByPk(giveawayId);
    if (!giveaway) {
      return interaction.reply({ content: "❌ Giveaway has ended or no longer exists.", ephemeral: true });
    }

    let participants: string[] = [];
    try {
      participants = JSON.parse(giveaway.participants);
    } catch (error) {
      console.error(`❌ Error parsing participants for Giveaway ${giveaway.id}:`, error);
    }

    const alreadyJoined = participants.includes(userId);

    if (isJoining) {
      if (alreadyJoined) {
        return interaction.reply({ content: "⚠️ You have already joined this giveaway!", ephemeral: true });
      }
      participants.push(userId);
    } else {
      if (!alreadyJoined) {
        return interaction.reply({ content: "⚠️ You are not in this giveaway!", ephemeral: true });
      }
      participants = participants.filter(id => id !== userId);
    }

    giveaway.participants = JSON.stringify(participants);
    await giveaway.save();

    const channel = interaction.channel as TextChannel;
    let giveawayMessage;

    // ✅ **Fix: Ensure `messageId` is valid before fetching**
    if (!giveaway.messageId || typeof giveaway.messageId !== "string") {
      console.warn(`⚠️ Giveaway messageId is missing or invalid for ID ${giveaway.id}. Skipping update.`);
      return interaction.reply({ content: "⚠️ Giveaway message not found. Skipping update.", ephemeral: true });
    }

    try {
      giveawayMessage = await channel.messages.fetch(giveaway.messageId);
    } catch (error) {
      console.warn(`⚠️ Giveaway message not found for ID ${giveaway.messageId}. Skipping update.`);
      return;
    }

    if (!giveawayMessage) {
      console.warn(`⚠️ Giveaway message is undefined for ID ${giveaway.id}.`);
      return;
    }

    const embed = EmbedBuilder.from(giveawayMessage.embeds[0]);
    embed.setFields([
      { name: "🎟️ Total Participants", value: `${participants.length} users`, inline: true }
    ]);

    await giveawayMessage.edit({ embeds: [embed] });

    await interaction.reply({
      content: isJoining ? "✅ You have successfully joined the giveaway!" : "✅ You have left the giveaway.",
      ephemeral: true
    });

  } catch (error) {
    console.error("❌ Error handling giveaway join/leave:", error);
  }
}