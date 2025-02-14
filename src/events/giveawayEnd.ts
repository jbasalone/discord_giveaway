import { Client, TextChannel, EmbedBuilder, Message, ActionRowBuilder, ButtonBuilder, ButtonStyle, GuildMember, PermissionFlagsBits } from 'discord.js';
import { Giveaway } from '../models/Giveaway';
import { Op } from 'sequelize';
import { GuildSettings } from '../models/GuildSettings';
import { cache } from '../utils/giveawayCache';

export async function handleGiveawayEnd(client: Client) {
  try {
    const currentTime = Math.floor(Date.now() / 1000);
    console.log(`🔍 Checking expired giveaways at timestamp ${currentTime}`);

    const expiredGiveaways = await Giveaway.findAll({
      where: { endsAt: { [Op.lte]: currentTime } },
    });

    console.log(`✅ Found ${expiredGiveaways.length} expired giveaways.`);

    if (expiredGiveaways.length === 0) {
      console.log("✅ No expired giveaways to process.");
      return;
    }

    for (const giveaway of expiredGiveaways) {
      const giveawayId = giveaway.get("id").toString();
      const giveawayType = giveaway.get("type") ?? "custom"; // ✅ Default to "custom" if missing

      if (!giveaway.get("guildId") || !giveaway.get("channelId") || !giveaway.get("messageId")) {
        console.warn(`⚠️ Skipping giveaway due to missing fields: ${JSON.stringify(giveaway, null, 2)}`);
        continue;
      }

      const guild = client.guilds.cache.get(giveaway.get("guildId"));
      if (!guild) {
        console.error(`❌ Guild not found for Giveaway ID ${giveawayId}`);
        continue;
      }

      const channel = guild.channels.cache.get(giveaway.get("channelId")) as TextChannel;
      if (!channel) {
        console.error(`❌ Channel not found for Giveaway ID ${giveawayId}`);
        continue;
      }

      let giveawayMessage: Message;
      try {
        giveawayMessage = await channel.messages.fetch(giveaway.get("messageId"));
        console.log(`✅ Successfully fetched giveaway message for ID ${giveawayId}: ${giveaway.get("messageId")}`);
      } catch (error) {
        console.warn(`⚠️ Giveaway message not found for ID ${giveawayId}. Skipping update.`);
        continue;
      }

      // ✅ Retrieve and Parse Participants
      let participants: string[] = [];
      try {
        participants = JSON.parse(giveaway.get("participants") ?? "[]");
        if (!Array.isArray(participants)) participants = [];
      } catch (error) {
        console.error(`❌ Error parsing participants for Giveaway ${giveawayId}:`, error);
        participants = [];
      }

      console.log(`🎟️ Total Participants for Giveaway ${giveawayId}: ${participants.length}`);

      // ✅ Check for `--force` Mode
      const forceMode = giveaway.get("forceStart") ?? false;
      const totalParticipants = participants.length;

      // ✅ Determine Number of Winners
      let winnerCount = 1; // Default

      if (giveawayType === "miniboss") {
        winnerCount = forceMode && totalParticipants < 9 ? totalParticipants : 9;
      } else {
        winnerCount = giveaway.get("winnerCount") ?? 1; // ✅ Use user-defined count or default to 1
      }

      // ✅ Select Winners
      let winners = "No winners.";
      let winnerList: string[] = [];

      if (totalParticipants > 0) {
        console.log(`🔹 Selecting ${winnerCount} winners for Giveaway ${giveawayId}`);

        // Shuffle and select winners
        const shuffledParticipants = [...participants].sort(() => Math.random() - 0.5);
        winnerList = shuffledParticipants.slice(0, winnerCount);
        winners = winnerList.map(id => `<@${id}>`).join(', ');

        console.log(`🏆 Winners selected for Giveaway ${giveawayId}: ${winners}`);
      } else {
        console.log(`❌ Not enough participants to select a winner.`);
      }

      // ✅ Store Winners in Cache BEFORE Deleting Giveaway
      cache.set(giveawayId, {
        participants: winnerList,
        title: giveaway.get("title"),
        forceStart: forceMode
      });

      // ✅ Parse Extra Fields
      const rawExtraFields = giveaway.get("extraFields") ?? "{}";
      let extraFields;
      try {
        extraFields = JSON.parse(rawExtraFields);
      } catch (error) {
        console.error(`❌ Error parsing extraFields for Giveaway ${giveawayId}:`, error);
        extraFields = {};
      }

      // ✅ **Generate Giveaway Message Link**
      const giveawayLink = `https://discord.com/channels/${giveaway.get("guildId")}/${giveaway.get("channelId")}/${giveaway.get("messageId")}`;

      // ✅ **Fetch Miniboss Channel**
      const guildSettings = await GuildSettings.findOne({ where: { guildId: giveaway.get("guildId") } });
      const minibossChannelId = guildSettings?.get("minibossChannelId") ?? null;
      const minibossChannel = minibossChannelId ? (guild.channels.cache.get(minibossChannelId) as TextChannel) : null;

      // ✅ **Grant Miniboss Channel Access to Winners**
      if (giveawayType === "miniboss" && minibossChannel) {
        for (const winnerId of winnerList) {
          try {
            const member = await guild.members.fetch(winnerId);
            await minibossChannel.permissionOverwrites.create(member, {
              ViewChannel: true,
              SendMessages: true
            });
            console.log(`✅ Granted Miniboss Channel Access to ${winnerId}`);
          } catch (error) {
            console.error(`❌ Error granting access to ${winnerId}:`, error);
          }
        }
      }

      // ✅ **Generate Mobile and Desktop Commands for Miniboss**
      const mobileCommand = `@epicRPG miniboss ${winnerList.map(id => `<@${id}>`).join(' ')}`;
      const desktopCommand = `@epicRPG miniboss ${winnerList.join(' ')}`;

      // ✅ **Create Buttons for Miniboss Command Selection**
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(`miniboss-mobile-${giveawayId}`).setLabel("📱 Mobile Command").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`miniboss-desktop-${giveawayId}`).setLabel("💻 Desktop Command").setStyle(ButtonStyle.Primary)
      );

      // ✅ **Update Embed to Indicate Giveaway has Ended**
      const embed = EmbedBuilder.from(giveawayMessage.embeds[0])
          .setFields([
            { name: "🎟️ Total Participants", value: `${participants.length} users`, inline: true },
            { name: "🏆 Winners", value: winners, inline: true },
            { name: "⏳ Status", value: "🛑 Ended!", inline: true },
            ...Object.entries(extraFields).map(([key, value]) => ({ name: key, value: String(value), inline: true }))
          ])
          .setColor("Red");

      await giveawayMessage.edit({ embeds: [embed] });

      // ✅ **Send Winner Announcement**
      if (giveawayType === "miniboss" && minibossChannel) {
        await minibossChannel.send({
          content: `🎉 **Miniboss Ended!** **${giveaway.get("title")}**\n🏆 **Winners:** ${winners}\n🔗 [View Giveaway](${giveawayLink})`,
          components: [row]
        });
      } else {
        await channel.send({
          content: `🎉 **Giveaway Ended!** **${giveaway.get("title")}**\n🏆 **Winners:** ${winners}\n🔗 [View Giveaway](${giveawayLink})`
        });
      }

      // ✅ **Delete giveaway from database**
      await Giveaway.destroy({ where: { id: giveawayId } });

      console.log(`✅ Giveaway ${giveawayId} successfully deleted.`);
    }
  } catch (error) {
    console.error("❌ Critical Error in `handleGiveawayEnd()`:", error);
  }
}