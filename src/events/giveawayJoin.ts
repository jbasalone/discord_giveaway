import { ButtonInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder } from 'discord.js';
import { Giveaway } from '../models/Giveaway';
import { BlacklistedRoles } from '../models/BlacklistedRoles';
import { cache } from '../utils/giveawayCache';
import { incrementStat } from '../utils/userStats'; // ← ensure this is at the top


// ✅ Cooldown system (per giveaway)
const userCooldowns = new Map<string, Map<string, number>>();
const cooldownTime = 5 * 1000;

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
      giveaway = cache.get(giveawayMessageId) ?? null;
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

    // ✅ **Per-Giveaway Cooldown Check**
    if (!userCooldowns.has(userId)) userCooldowns.set(userId, new Map());
    const userGiveawayCooldowns = userCooldowns.get(userId)!;

    if (userGiveawayCooldowns.has(giveawayMessageId) && Date.now() - userGiveawayCooldowns.get(giveawayMessageId)! < cooldownTime) {
      return await interaction.reply({ content: '⚠️ Please wait before joining/leaving again!', ephemeral: true });
    }

    userGiveawayCooldowns.set(giveawayMessageId, Date.now());

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

    // ✅ **Update Participants**
    if (isJoining) {
      participants.push(userId);
      await incrementStat(userId, guildId, 'joined');
    } else {
      participants = participants.filter(id => id !== userId);
    }

    await giveaway.update({ participants: JSON.stringify(participants) });

    // ✅ **Update Embed (Participants Count)**
    let embed = EmbedBuilder.from(interaction.message.embeds[0]);

    if (!embed.data.fields) {
      embed.setFields([]);
    }

    const totalParticipantsIndex = embed.data.fields?.findIndex(f => f.name.includes('🎟️ Total Participants')) ?? -1;

    if (totalParticipantsIndex !== -1) {
      embed.spliceFields(totalParticipantsIndex, 1, { name: '🎟️ Total Participants', value: `${participants.length} users`, inline: true });
    } else {
      embed.addFields({ name: '🎟️ Total Participants', value: `${participants.length} users`, inline: true });
    }

    // ✅ **Modify Buttons WITHOUT Disabling Them**
    const updatedButtons = interaction.message.components.map(row => {
      return new ActionRowBuilder<ButtonBuilder>().addComponents(
          row.components.map(component => ButtonBuilder.from(component as unknown as ButtonBuilder))
      );
    });

    // ✅ **Edit the original message for all users without disabling buttons**
    await interaction.message.edit({ embeds: [embed], components: updatedButtons });

    // ✅ **Send an Ephemeral Response to the User**
    await interaction.reply({
      content: isJoining
          ? '✅ **You have successfully joined the giveaway!** 🎉'
          : '❌ **You have left the giveaway.**',
      ephemeral: true
    });

  } catch (error) {
    console.error('❌ Error handling giveaway join/leave:', error);

    // ✅ **Prevent Bot Crashes by Handling Errors Gracefully**
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ An error occurred. Please try again later.', ephemeral: true });
    }
  }
}