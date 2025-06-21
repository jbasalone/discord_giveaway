import {
  Client,
  TextChannel,
  EmbedBuilder,
  Message,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { Giveaway } from '../models/Giveaway';
import { ExtraEntries } from '../models/ExtraEntries';
import { cache } from '../utils/giveawayCache';
import { handleMinibossCommand } from './handleMinibossCommnand';
import { saveJoiners } from '../utils/rerollCache';
import { incrementStat } from '../utils/userStats';


/**
 * Handles the end of a giveaway and processes winners.
 */
export async function handleGiveawayEnd(client: Client, giveawayId?: number) {
  try {
    console.log(`🔍 Ending giveaway: ${giveawayId}`);
    if (!giveawayId) return;

    if (cache.has(`giveaway-processing-${giveawayId}`)) {
      console.warn(`⚠️ Giveaway ${giveawayId} is already being processed. Skipping.`);
      return;
    }
    cache.set(`giveaway-processing-${giveawayId}`, true, 600);

    let giveaway = await Giveaway.findOne({ where: { id: giveawayId } });
    if (!giveaway) {
      console.warn(`⚠️ Giveaway ${giveawayId} not found in DB. Checking cache.`);
      giveaway = cache.get(String(giveawayId)) ?? null;
    }
    if (!giveaway) {
      console.error(`❌ Giveaway ${giveawayId} is missing in both DB and Cache.`);
      cache.del(`giveaway-processing-${giveawayId}`);
      return;
    }

    const guildId = giveaway.get("guildId");
    if (!guildId) {
      console.error(`❌ Missing guildId for giveaway ${giveawayId}`);
      cache.del(`giveaway-processing-${giveawayId}`);
      return;
    }

    const guild = client.guilds.cache.get(String(guildId));
    if (!guild) {
      console.error(`❌ Guild ${guildId} not found in cache.`);
      cache.del(`giveaway-processing-${giveawayId}`);
      return;
    }

    const channel = guild.channels.cache.get(String(giveaway.get("channelId") ?? "")) as TextChannel;
    if (!channel) {
      console.error(`[ERROR] [giveawayEnd.ts] ❌ Giveaway channel not found for guild ${guildId}`);
      cache.del(`giveaway-processing-${giveawayId}`);
      return;
    }

    let participants: string[] = JSON.parse(giveaway.get("participants") ?? "[]");
    await saveJoiners(
        String(giveaway.get("messageId")),
        guildId,
        String(giveaway.get("channelId")),
        participants,
        Number(giveaway.get("winnerCount")) || 1,
        JSON.parse(giveaway.get("guaranteedWinners") ?? "[]"),
        0,
        giveawayId
    );

    let giveawayMessage: Message | null = null;
    try {
      giveawayMessage = await channel.messages.fetch(String(giveaway.get("messageId")));
    } catch (error) {
      console.error(`[ERROR] Giveaway message not found: ${error}`);
    }

    if (!giveawayMessage) {
      const hostId = giveaway.get("hostId") as string || giveaway.get("host") as string;
      if (hostId) {
        try {
          const hostUser = await client.users.fetch(hostId);
          await hostUser.send(
              `⚠️ Your giveaway (ID: ${giveawayId}) in **${guild.name}** has been deleted or is inaccessible. Please recreate it if necessary.`
          );
          console.log(`📩 Sent DM to host (${hostId}) about missing giveaway ${giveawayId}.`);
        } catch (dmError) {
          console.error(`❌ Failed to DM host (${hostId}) about missing giveaway:`, dmError);
        }
      } else {
        console.warn(`⚠️ Host ID is missing for giveaway ${giveawayId}. Cannot send DM.`);
      }
      console.log(`🎟️ Total Participants for Giveaway ${giveawayId}: ${participants.length}`);
      // Only need saveJoiners once!
      await Giveaway.destroy({ where: { id: giveawayId } });
      cache.del(`giveaway-processing-${giveawayId}`);
      console.log(`✅ Giveaway ${giveawayId} removed from the database.`);
      return;
    }

    console.log(`🎟️ Total Participants for Giveaway ${giveawayId}: ${participants.length}`);
    if (participants.length === 0) {
      console.warn(`⚠️ No participants found for giveaway ${giveawayId}.`);
    }

    const isForced = Boolean(Number(giveaway.get("forceStart")));

    // ---- MINIBOSS ----
    if (giveaway.get("type") === "miniboss") {
      console.log(`✅ [DEBUG] Processing Miniboss Giveaway ${giveawayId}...`);
      if (cache.has(`miniboss-running-${giveawayId}`)) {
        console.warn(`⚠️ Miniboss giveaway ${giveawayId} is already running. Skipping duplicate execution.`);
        cache.del(`giveaway-processing-${giveawayId}`);
        return;
      }

      cache.set(`miniboss-running-${giveawayId}`, true, 600);
      if (isForced || participants.length >= 9) {
        try {
          await handleMinibossCommand(client, giveawayId, [...new Set([...participants])]);
          await Giveaway.destroy({ where: { id: giveawayId } });
          console.log(`🧹 Miniboss Giveaway ${giveawayId} cleaned from DB after successful execution.`);
        } catch (err) {
          console.error(`❌ Error running handleMinibossCommand:`, err);
        }
        cache.del(`giveaway-processing-${giveawayId}`);
        cache.del(`miniboss-running-${giveawayId}`);
      } else {
        try {
          await channel.send({
            content: `❌ Miniboss Giveaway cannot proceed due to insufficient participants.\n🔗 [Jump to Giveaway](https://discord.com/channels/${guild.id}/${channel.id}/${giveaway.get("messageId")})`,
          });
          await Giveaway.destroy({ where: { id: giveawayId } });
          console.log(`🧹 Miniboss Giveaway ${giveawayId} removed after failure (not enough participants).`);
        } catch (sendErr) {
          console.error(`❌ Error sending failure message:`, sendErr);
        }
        cache.del(`giveaway-processing-${giveawayId}`);
        cache.del(`miniboss-running-${giveawayId}`);
      }
      return;
    }
    // ---- END MINIBOSS ----

    // Normal giveaways:
    let winners = "No winners.";
    let winnerList: string[] = [];
    const maxWinners = Number(giveaway.get("winnerCount"));

    // Extra entries (weight)
    let useExtraEntries = Boolean(Number(giveaway.get("useExtraEntries")));
    let participantsWithWeights: string[] = [];
    if (useExtraEntries) {
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

    let availableWinners = [...new Set([...participantsWithWeights])];
    while (winnerList.length < maxWinners && availableWinners.length > 0) {
      const winnerIndex = Math.floor(Math.random() * availableWinners.length);
      const winner = availableWinners.splice(winnerIndex, 1)[0];
      if (!winnerList.includes(winner)) {
        winnerList.push(winner);
      }
    }
    for (const winnerId of winnerList) {
      await incrementStat(winnerId, guild.id, 'won');
    }
    winners = winnerList.length > 0 ? winnerList.map(id => `<@${id}>`).join(", ") : "No winners.";

    const existingEmbed = giveawayMessage.embeds[0] ?? new EmbedBuilder().setTitle(giveaway.get("title") ?? "Giveaway").setColor("Red");

    const updatedEmbed = EmbedBuilder.from(existingEmbed)
        .setFields(
            ...existingEmbed.fields.filter(field => !["🎟️ Total Participants", "🏆 Winners", "⏳ Ends In"].includes(field.name)),
            { name: "🎟️ Total Participants", value: `${participants.length} users`, inline: true },
            { name: "🏆 Winners", value: winners, inline: true },
            { name: "⏳ Ends In", value: ":warning: Ended!", inline: true }
        );

    const disabledButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`join-${giveawayMessage.id}`).setLabel("Join 🎉").setStyle(ButtonStyle.Success).setDisabled(true),
        new ButtonBuilder().setCustomId(`leave-${giveawayMessage.id}`).setLabel("Leave 💨").setStyle(ButtonStyle.Danger).setDisabled(true)
    );

    // ---- MESSAGE EDIT + ANNOUNCE ----
    try {
      await giveawayMessage.edit({ embeds: [updatedEmbed], components: [disabledButtons] });
    } catch (editErr) {
      console.error(`❌ Error editing giveaway message:`, editErr);
    }
    try {
      await channel.send({
        content: `🎉 **Giveaway Ended!** 🎉\n🏆 **Winners:** ${winners}\n🔗 [Jump to Giveaway](https://discord.com/channels/${guild.id}/${channel.id}/${giveaway.get("messageId")})`,
      });
    } catch (sendErr) {
      console.error(`❌ Error sending end message:`, sendErr);
    }

    // ---- DM Host ----
    let hostId: string | undefined = undefined;
    const rawHostId = giveaway.get("hostId") || giveaway.get("host");
    if (typeof rawHostId === "string" && rawHostId.match(/^\d+$/)) {
      hostId = rawHostId;
    } else if (typeof rawHostId === "number") {
      hostId = String(rawHostId);
    }
    if (hostId) {
      try {
        const hostUser = await client.users.fetch(hostId);
        await hostUser.send(
            `🎉 Your giveaway **"${giveaway.get("title")}"** in **${guild.name}** has ended!\n`
            + `🏆 Winners: ${winners}\n`
            + `🔗 [Jump to Giveaway](https://discord.com/channels/${guild.id}/${channel.id}/${giveaway.get("messageId")})`
        );
        console.log(`📩 DM sent to host (${hostId}) about the end of giveaway ${giveawayId}.`);
      } catch (dmErr) {
        console.error(`❌ Could not DM host (${hostId}) for ended giveaway ${giveawayId}:`, dmErr);
      }
    } else {
      console.warn(`⚠️ Host ID missing for giveaway ${giveawayId}, can't send DM.`);
    }

    await Giveaway.destroy({ where: { id: giveawayId } });
    cache.del(`giveaway-processing-${giveawayId}`);
    console.log(`✅ Giveaway ${giveawayId} successfully ended.`);
    console.log(`🧹 Giveaway ${giveawayId} cleaned up from DB after successful end.`);
  } catch (error) {
    console.error("❌ Error in `handleGiveawayEnd()`:", error);
    if (giveawayId) cache.del(`giveaway-processing-${giveawayId}`);
  }
}