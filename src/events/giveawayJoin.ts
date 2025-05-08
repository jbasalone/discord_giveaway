import {
  ButtonInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
} from 'discord.js';
import { Giveaway } from '../models/Giveaway';
import { BlacklistedRoles } from '../models/BlacklistedRoles';
import { cache } from '../utils/giveawayCache';
import { incrementStat } from '../utils/userStats';

const userCooldowns = new Map<string, Map<string, number>>();
const cooldownTime = 5000; // 5 seconds

export async function executeJoinLeave(interaction: ButtonInteraction) {
  try {
    const giveawayPrefixRegex = /^(gwjoin|gwleave)-\d+$/;
    console.log(`📩 Handling giveaway interaction: ${interaction.customId}`);

    if (!giveawayPrefixRegex.test(interaction.customId)) {
      console.log(`⛔ Ignored unrelated button: ${interaction.customId}`);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.deferUpdate().catch(() => {});
      }
      return;
    }

    const isJoining = interaction.customId.startsWith('gwjoin-');
    const userId = interaction.user.id;
    const guildId = interaction.guild?.id;
    const giveawayMessageId = interaction.customId.split('-')[1];

    if (!guildId) {
      return await interaction.reply({ content: '❌ Guild ID missing.', ephemeral: true });
    }

    let giveaway = await Giveaway.findOne({ where: { messageId: giveawayMessageId } });
    if (!giveaway) {
      console.warn(`⚠️ Giveaway ${giveawayMessageId} not found in DB, checking cache...`);
      giveaway = cache.get(giveawayMessageId) ?? null;
    }

    if (!giveaway) {
      return await interaction.reply({ content: '❌ This giveaway has ended or is corrupted.', ephemeral: true });
    }

    const endsAt = giveaway.get('endsAt');
    const currentTime = Math.floor(Date.now() / 1000);
    if (endsAt <= currentTime) {
      return await interaction.reply({ content: '❌ This giveaway has already ended!', ephemeral: true });
    }

    let participants: string[] = JSON.parse(giveaway.get('participants') || '[]');
    const alreadyJoined = participants.includes(userId);

    if (!userCooldowns.has(userId)) userCooldowns.set(userId, new Map());
    const userGiveawayCooldowns = userCooldowns.get(userId)!;

    if (userGiveawayCooldowns.has(giveawayMessageId) &&
        Date.now() - userGiveawayCooldowns.get(giveawayMessageId)! < cooldownTime) {
      return await interaction.reply({ content: '⚠️ Please wait before joining/leaving again!', ephemeral: true });
    }

    userGiveawayCooldowns.set(giveawayMessageId, Date.now());

    if (isJoining && alreadyJoined) {
      return await interaction.reply({ content: '⚠️ You have already joined this giveaway!', ephemeral: true });
    }
    if (!isJoining && !alreadyJoined) {
      return await interaction.reply({ content: '⚠️ You are not in this giveaway!', ephemeral: true });
    }

    const blacklistedRoles = await BlacklistedRoles.findAll({ where: { guildId } });
    const blacklistedRoleIds = blacklistedRoles.map(entry => entry.roleId);

    const member = await interaction.guild?.members.fetch(userId).catch(() => null);
    if (member && member.roles.cache.hasAny(...blacklistedRoleIds)) {
      return await interaction.reply({ content: "❌ You are blacklisted from joining giveaways!", ephemeral: true });
    }

    if (isJoining) {
      participants.push(userId);
      await incrementStat(userId, guildId, 'joined');
    } else {
      participants = participants.filter(id => id !== userId);
    }

    await giveaway.update({ participants: JSON.stringify(participants) });

    let embed = EmbedBuilder.from(interaction.message.embeds[0]);

    if (!embed.data.fields) {
      embed.setFields([]);
    }

// 🛡️ Safe type assertion
    const fields = embed.data.fields!;

    const fieldIndex = fields.findIndex(f => f.name.includes('🎟️ Total Participants'));
    if (fieldIndex !== -1) {
      embed.spliceFields(fieldIndex, 1, {
        name: '🎟️ Total Participants',
        value: `${participants.length} users`,
        inline: true,
      });
    } else {
      embed.addFields({
        name: '🎟️ Total Participants',
        value: `${participants.length} users`,
        inline: true,
      });
    }

    const updatedButtons = interaction.message.components.map(row =>
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            row.components.map(component =>
                ButtonBuilder.from(component as unknown as ButtonBuilder)
            )
        )
    );

    await interaction.message.edit({ embeds: [embed], components: updatedButtons });

    await interaction.reply({
      content: isJoining
          ? '✅ You have successfully joined the giveaway! 🎉'
          : '❌ You have left the giveaway.',
      ephemeral: true,
    });

  } catch (error) {
    console.error('❌ Error handling giveaway join/leave:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ An error occurred. Please try again later.', ephemeral: true });
    }
  }
}