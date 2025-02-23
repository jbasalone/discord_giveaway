import {
  Client,
  TextChannel,
  EmbedBuilder,
  Message,
} from 'discord.js';
import { Giveaway } from '../models/Giveaway';
import { ExtraEntries } from '../models/ExtraEntries';
import { cache } from '../utils/giveawayCache';
import { handleMinibossCommand } from './handleMinibossCommnand';

/**
 * Handles the end of a giveaway and processes winners.
 */
export async function handleGiveawayEnd(client: Client, giveawayId?: number) {
  try {
    console.log(`🔍 Ending giveaway: ${giveawayId}`);

    if (!giveawayId) return;

    let giveaway = await Giveaway.findOne({ where: { id: giveawayId } });

    if (!giveaway) {
      console.warn(`⚠️ Giveaway ${giveawayId} not found in DB. Checking cache.`);
      giveaway = cache.get(String(giveawayId));
    }

    if (!giveaway) {
      console.error(`❌ Giveaway ${giveawayId} is missing in both DB and Cache.`);
      return;
    }

    const guildId = giveaway.get("guildId");
    if (!guildId) {
      console.error(`❌ Missing guildId for giveaway ${giveawayId}`);
      return;
    }

    console.log(`✅ Giveaway ${giveawayId} is in Guild ${guildId}`);

    const guild = client.guilds.cache.get(String(guildId));
    if (!guild) {
      console.error(`❌ Guild ${guildId} not found in cache.`);
      return;
    }

    const channel = guild.channels.cache.get(String(giveaway.get("channelId") ?? "")) as TextChannel;
    if (!channel) {
      console.error(`❌ Giveaway channel not found for guild ${guildId}`);
      return;
    }

    let giveawayMessage: Message | null = null;
    try {
      giveawayMessage = await channel.messages.fetch(String(giveaway.get("messageId")));
    } catch (error) {
      console.error(`❌ Could not fetch giveaway message: ${error}`);
      return;
    }

    let participants: string[] = JSON.parse(giveaway.get("participants") ?? "[]");
    console.log(`🎟️ Total Participants for Giveaway ${giveawayId}: ${participants.length}`);

    if (participants.length === 0) {
      console.warn(`⚠️ No participants found for giveaway ${giveawayId}.`);
    }

    const isForced = Boolean(Number(giveaway.get("forceStart")));


    // ✅ **Miniboss Giveaway Logic**
    if (giveaway.get("type") === "miniboss") {
      console.log(`🔍 Miniboss Giveaway Detected! Checking participant count... (Participants: ${participants.length}, isForced: ${isForced})`);

      if (isForced || participants.length >= 10) {
        console.log(`🚀 **Proceeding with Miniboss Giveaway** (Forced: ${isForced}, Participants: ${participants.length})`);
        await handleMinibossCommand(client, giveawayId, participants);

      } else {
        console.warn(`❌ Miniboss Giveaway cannot proceed due to insufficient participants.`);
        return;
      }
    } else {

      let winners = "No winners.";
      let winnerList: string[] = [];
      const maxWinners = Number(giveaway.get("winnerCount"));

      let useExtraEntries = false;
      try {
        const extraFields = JSON.parse(giveaway.get("extraFields") ?? "{}");
        useExtraEntries = extraFields.useExtraEntries === "true";
      } catch {
        useExtraEntries = false;
      }

      const shouldUseExtraEntries = useExtraEntries || giveaway.get("type") === "giveaway" || giveaway.get("type") === "custom";
      const participantsWithWeights: string[] = [];

      if (shouldUseExtraEntries) {
        console.log(`📌 Applying extra entries for Giveaway ${giveawayId}.`);

        const extraEntriesData = await ExtraEntries.findAll({ where: { guildId } });
        const roleBonusMap = new Map(extraEntriesData.map(entry => [entry.roleId, entry.bonusEntries]));

        for (const userId of participants) {
          const member = await guild.members.fetch(userId).catch(() => null);
          if (!member) continue;

          let extraEntries = 0;
          for (const [roleId, bonusEntries] of roleBonusMap) {
            if (member.roles.cache.has(roleId)) {
              extraEntries += bonusEntries;
            }
          }

          for (let i = 0; i <= extraEntries; i++) {
            participantsWithWeights.push(userId);
          }
        }
      } else {
        participantsWithWeights.push(...participants);
      }

      while (winnerList.length < maxWinners && participantsWithWeights.length > 0) {
        const winnerIndex = Math.floor(Math.random() * participantsWithWeights.length);
        const winner = participantsWithWeights.splice(winnerIndex, 1)[0];

        if (!winnerList.includes(winner)) {
          winnerList.push(winner);
        }
      }

      winners = winnerList.length > 0 ? winnerList.map(id => `<@${id}>`).join(", ") : "No winners.";

      let embed = giveawayMessage.embeds.length > 0
          ? EmbedBuilder.from(giveawayMessage.embeds[0])
          : new EmbedBuilder().setTitle(giveaway.get("title") ?? "Giveaway");

      embed.data.fields = embed.data.fields?.filter(field =>
          !["🎟️ Total Participants", "🏆 Winners"].includes(field.name)
      ) ?? [];

      embed.addFields([
        { name: "🎟️ Total Participants", value: `${participants.length} users`, inline: true },
        { name: "🏆 Winners", value: winners, inline: true }
      ]);

      if (embed.data.fields.length > 25) {
        embed.data.fields = embed.data.fields.slice(0, 25);
      }

      embed.setColor('Red');

      await giveawayMessage.edit({ embeds: [embed] });

      await channel.send({
        content: `🎉 **Giveaway Ended!** 🎉\n🏆 **Winners:** ${winners}\n🔗 [Giveaway Link](https://discord.com/channels/${guild.id}/${channel.id}/${giveaway.get("messageId")})`,
      });
    }

    await Giveaway.destroy({ where: { id: giveawayId } });

    console.log(`✅ Giveaway ${giveawayId} successfully deleted.`);
  } catch (error) {
    console.error("❌ Error in `handleGiveawayEnd()`:", error);
  }
}