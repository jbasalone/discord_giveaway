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
      console.log(`📌 [DEBUG] [giveawayEnd.ts] Cache Lookup for Giveaway ${giveawayId}:`, cache.get(String(giveawayId)));
      giveaway = cache.get(String(giveawayId)) ?? null;
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
      console.error(`[ERROR] [giveawayEnd.ts] ❌ Giveaway channel not found for guild ${guildId}`);
      return;
    }

    let giveawayMessage: Message | null = null;
    try {
      giveawayMessage = await channel.messages.fetch(String(giveaway.get("messageId")));
    } catch (error) {
      console.error(`[ERROR] Giveaway message not found: ${error}`);
    }
    if (!giveawayMessage) {
      return channel.send("❌ Giveaway message has been deleted or is inaccessible.");
    }

    let participants: string[] = JSON.parse(giveaway.get("participants") ?? "[]");
    console.log(`🎟️ Total Participants for Giveaway ${giveawayId}: ${participants.length}`);

    if (participants.length === 0) {
      console.warn(`⚠️ No participants found for giveaway ${giveawayId}.`);
    }

    const isForced = Boolean(Number(giveaway.get("forceStart")));

    // ✅ **Retrieve Guaranteed Winners**
    let guaranteedWinners: string[] = JSON.parse(giveaway.get("guaranteedWinners") ?? "[]");
    console.log(`🔒 Guaranteed Winners for Giveaway ${giveawayId}:`, guaranteedWinners);

    if (giveaway.get("type") === "miniboss") {
      console.log(`🔍 Miniboss Giveaway Detected! Checking participant count... (Participants: ${participants.length}, isForced: ${isForced})`);

      if (isForced || participants.length >= 9) {
        console.log(`🚀 **Proceeding with Miniboss Giveaway** (Forced: ${isForced}, Participants: ${participants.length})`);
        console.log(`🔄 [DEBUG] handleGiveawayEnd() Triggered for Giveaway ID: ${giveawayId}`);
        // ✅ **Pass Guaranteed Winners to Miniboss Command**
        if (cache.has(`miniboss-running-${giveawayId}`)) {
          console.warn(`⚠️ Miniboss giveaway ${giveawayId} is already running. Skipping duplicate execution.`);
          return;
        }
        cache.set(`miniboss-running-${giveawayId}`, true, 600); // Prevents duplicates for 10 minutes
        await handleMinibossCommand(client, giveawayId, [...new Set([...guaranteedWinners, ...participants])]);


      } else {
        await channel.send({
          content: `❌ Miniboss Giveaway cannot proceed due to insufficient participants. [Giveaway Link](https://discord.com/channels/${guild.id}/${channel.id}/${giveaway.get("messageId")})`,
        });
        console.warn(`[DEBUG] [giveawayEnd.ts] ❌ Miniboss Giveaway cannot proceed due to insufficient participants.`);

        return;
      }
    }

    let winners = "No winners.";
    let winnerList: string[] = [];
    const maxWinners = Number(giveaway.get("winnerCount"));

    // ✅ **Apply Extra Entries Bonus (Weight-based Selection)**
    let useExtraEntries = Boolean(Number(giveaway.get("useExtraEntries")));
    let participantsWithWeights: string[] = [];

    if (useExtraEntries) {
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

    // ✅ **Merge Guaranteed Winners & Randomly Pick Others**
    let availableWinners = [...new Set([...guaranteedWinners, ...participantsWithWeights])];

    while (winnerList.length < maxWinners && availableWinners.length > 0) {
      const winnerIndex = Math.floor(Math.random() * availableWinners.length);
      const winner = availableWinners.splice(winnerIndex, 1)[0];

      if (!winnerList.includes(winner)) {
        winnerList.push(winner);
      }
    }

    winners = winnerList.length > 0 ? winnerList.map(id => `<@${id}>`).join(", ") : "No winners.";

    // ✅ **Retrieve existing embed instead of overwriting**
    const existingEmbed = giveawayMessage.embeds[0] ?? new EmbedBuilder().setTitle(giveaway.get("title") ?? "Giveaway").setColor("Red");

    // ✅ **Modify only the winners & participant fields**
    const updatedEmbed = EmbedBuilder.from(existingEmbed)
        .setFields(
            ...existingEmbed.fields.filter(field => !["🎟️ Total Participants", "🏆 Winners", "⏳ Ends In"].includes(field.name)), // Preserve other fields
            { name: "🎟️ Total Participants", value: `${participants.length} users`, inline: true },
            { name: "🏆 Winners", value: winners, inline: true },
            { name: "⏳ Ends In", value: ":warning: Ended!", inline: true}
        );

    // ✅ **Disable buttons instead of removing them**
    const disabledButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`join-${giveawayMessage.id}`).setLabel("Join 🐉").setStyle(ButtonStyle.Success).setDisabled(true),
        new ButtonBuilder().setCustomId(`leave-${giveawayMessage.id}`).setLabel("Leave 💨").setStyle(ButtonStyle.Danger).setDisabled(true)
    );

    await giveawayMessage.edit({ embeds: [updatedEmbed], components: [disabledButtons] });


    await channel.send({
      content: `🎉 **Giveaway Ended!** 🎉\n🏆 **Winners:** ${winners}\n🔗 [Giveaway Link](https://discord.com/channels/${guild.id}/${channel.id}/${giveaway.get("messageId")})`,
    });

    await Giveaway.destroy({ where: { id: giveawayId } });

    console.log(`✅ Giveaway ${giveawayId} successfully deleted.`);
  } catch (error) {
    console.error("❌ Error in `handleGiveawayEnd()`:", error);
  }
}