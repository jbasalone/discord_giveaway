import {
  Client,
  TextChannel,
  EmbedBuilder,
  Message,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder
} from 'discord.js';
import { Giveaway } from '../models/Giveaway';
import { GuildSettings } from '../models/GuildSettings';
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

    const guildId = giveaway.get ? giveaway.get("guildId") : giveaway.guildId;
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

    let winners = "No winners.";
    let winnerList: string[] = [];

    if (participants.length > 0) {
      const shuffledParticipants = [...participants].sort(() => Math.random() - 0.5);
      winnerList = shuffledParticipants.slice(0, Number(giveaway.get("winnerCount")));
      winners = winnerList.map((id) => `<@${id}>`).join(", ");
    }

    // ✅ Store necessary data in cache before deleting from DB
    cache.set(String(giveawayId), {
      guildId: guildId,
      winnerCount: giveaway.get("winnerCount"),
      participants: winnerList,
      type: giveaway.get("type"),
    });

    // ✅ Extract embeds from fetched `giveawayMessage`
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

    // ✅ Check if this is a miniboss giveaway
    if (giveaway.get("type") === "miniboss") {
      let minibossChannelId: string | null = giveaway.get("minibossChannel") as string | null;

      // ✅ Fetch `minibossChannelId` from `GuildSettings` if missing
      if (!minibossChannelId) {
        console.warn(`⚠️ Miniboss channel ID missing in Giveaway. Fetching from GuildSettings...`);

        const guildSettings = await GuildSettings.findOne({
          attributes: ['minibossChannelId'],
          where: { guildId: guildId },
        });

        console.log(`🔍 Retrieved GuildSettings:`, guildSettings?.dataValues);

        minibossChannelId = guildSettings?.get("minibossChannelId") ?? null;

        if (minibossChannelId) {
          console.log(`✅ Miniboss channel ID found in GuildSettings: ${minibossChannelId}`);
        } else {
          console.error(`❌ Miniboss channel ID is missing from both Giveaway and GuildSettings for guild ${guildId}`);
          return;
        }
      }

      // ✅ Ensure `minibossChannelId` is valid
      if (typeof minibossChannelId !== "string") {
        console.error(`❌ Miniboss channel ID is not a valid string: ${JSON.stringify(minibossChannelId)}`);
        return;
      }

      const minibossChannel = guild.channels.cache.get(minibossChannelId) as TextChannel;
      if (!minibossChannel) {
        console.error(`❌ Miniboss channel ${minibossChannelId} does not exist!`);
        return;
      }

      console.log(`🔍 Calling handleMinibossCommand before deletion for giveaway: ${giveawayId}`);
      await handleMinibossCommand(client, giveawayId);

    } else {
      // ✅ Standard giveaway: Send a message announcing winners
      await channel.send({
        content: `🎉 **Giveaway Ended!** 🎉\n🏆 **Winners:** ${winners}\n🔗 [Giveaway Link](https://discord.com/channels/${guild.id}/${channel.id}/${giveaway.get("messageId")})`,
      });
    }

    // ✅ Ensure cache is stored before deleting
    cache.set(String(giveawayId), {
      guildId: guildId,
      winnerCount: giveaway.get("winnerCount"),
      participants: winnerList,
      type: giveaway.get("type"),
    });

    await Giveaway.destroy({ where: { id: giveawayId } });

    console.log(`✅ Giveaway ${giveawayId} successfully deleted.`);
  } catch (error) {
    console.error("❌ Error in `handleGiveawayEnd()`:", error);
  }
}