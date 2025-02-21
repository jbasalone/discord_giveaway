import { ButtonInteraction, EmbedBuilder } from 'discord.js';
import { Giveaway } from '../models/Giveaway';
import { BlacklistedRoles } from '../models/BlacklistedRoles';
import { cache } from '../utils/giveawayCache';

const userCooldowns = new Map<string, number>();
const cooldownTime = 10 * 1000;

export async function executeJoinLeave(interaction: ButtonInteraction) {
  try {
    if (!interaction.customId.startsWith('join-') && !interaction.customId.startsWith('leave-')) return;

    const isJoining = interaction.customId.startsWith('join-');
    const userId = interaction.user.id;
    const guildId = interaction.guild?.id;
    const giveawayMessageId = interaction.customId.split('-')[1];

    if (!guildId) {
      return await interaction.reply({ content: '❌ An error occurred. Guild ID missing.', ephemeral: true });
    }

    let giveaway = await Giveaway.findOne({ where: { messageId: giveawayMessageId } });

    if (!giveaway) {
      console.warn(`⚠️ Giveaway ${giveawayMessageId} not found in DB, checking cache...`);
      giveaway = cache.get(giveawayMessageId);
    }

    if (!giveaway) {
      return await interaction.reply({ content: '❌ This giveaway has ended or is corrupted.', ephemeral: true });
    }

    const endsAt: number = giveaway.get('endsAt');
    const currentTime = Math.floor(Date.now() / 1000);
    if (endsAt <= currentTime) {
      return await interaction.reply({ content: '❌ This giveaway has already ended!', ephemeral: true });
    }

    let participants: string[] = JSON.parse(giveaway.get('participants') || '[]');
    const alreadyJoined = participants.includes(userId);

    if (userCooldowns.has(userId) && Date.now() - userCooldowns.get(userId)! < cooldownTime) {
      return await interaction.reply({ content: '⚠️ Please wait before joining/leaving again!', ephemeral: true });
    }
    userCooldowns.set(userId, Date.now());

    if (isJoining && alreadyJoined) {
      return await interaction.reply({ content: '⚠️ You have already joined this giveaway!', ephemeral: true });
    }
    if (!isJoining && !alreadyJoined) {
      return await interaction.reply({ content: '⚠️ You are not in this giveaway!', ephemeral: true });
    }

    // ✅ **Check if user has a blacklisted role**
    const blacklistedRoles = await BlacklistedRoles.findAll({ where: { guildId } });
    const blacklistedRoleIds = blacklistedRoles.map(entry => entry.roleId);

    const member = await interaction.guild?.members.fetch(userId).catch(() => null);
    if (member && member.roles.cache.hasAny(...blacklistedRoleIds)) {
      return await interaction.reply({ content: "❌ You are **blacklisted** from joining giveaways!", ephemeral: true });
    }

    // ✅ If user is not blacklisted, process join/leave
    if (isJoining) {
      participants.push(userId);
    } else {
      participants = participants.filter(id => id !== userId);
    }

    await giveaway.update({ participants: JSON.stringify(participants) });

    // Preserve existing embed fields instead of adding duplicates
    let embed = EmbedBuilder.from(interaction.message.embeds[0]);

    // Ensure fields exist before accessing
    if (!embed.data.fields) {
      embed.setFields([]);
    }

    // Find "Total Participants" field safely
    const totalParticipantsIndex = embed.data.fields?.findIndex(f => f.name.includes('🎟️ Total Participants')) ?? -1;

    if (totalParticipantsIndex !== -1) {
      // ✅ Update existing field
      embed.spliceFields(totalParticipantsIndex, 1, { name: '🎟️ Total Participants', value: `${participants.length} users`, inline: true });
    } else {
      // ✅ Add new field if it doesn't exist
      embed.addFields({ name: '🎟️ Total Participants', value: `${participants.length} users`, inline: true });
    }

    await interaction.message.edit({ embeds: [embed] });

    return await interaction.reply({
      content: isJoining ? '✅ You have successfully joined the giveaway!' : '✅ You have left the giveaway.',
      ephemeral: true
    });

  } catch (error) {
    console.error('❌ Error handling giveaway join/leave:', error);
    return await interaction.reply({ content: '❌ An error occurred. Please try again later.', ephemeral: true });
  }
}