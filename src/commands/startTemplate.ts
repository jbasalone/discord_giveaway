import { Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel } from 'discord.js';
import { SavedGiveaway } from '../models/SavedGiveaway';
import { Giveaway } from '../models/Giveaway';
import { Client } from 'discord.js';
import { startLiveCountdown } from '../utils/giveawayTimer';

export async function execute(message: Message, args: string[], client: Client) {
  try {
    if (args.length < 1) return message.reply("❌ Invalid usage! Example: `!ga starttemplate \"Weekly Giveaway\"`");

    const templateName = args.join(" ");
    const savedTemplate = await SavedGiveaway.findOne({
      where: { name: templateName, guildId: message.guild!.id }
    });

    if (!savedTemplate) return message.reply(`❌ No template found with the name **${templateName}**.`);

    const channel = message.channel as TextChannel;
    const endsAt = Math.floor(Date.now() / 1000) + Math.floor(savedTemplate.duration / 1000);

    // ✅ Determine if it's a Miniboss Giveaway based on the title
    const isMiniboss = savedTemplate.title.toLowerCase().includes("miniboss") || savedTemplate.extraFields.includes("Miniboss");

    // ✅ Create a new giveaway from the saved template
    const giveawayData = await Giveaway.create({
      host: message.author.id,
      channelId: channel.id,
      messageId: null,
      title: savedTemplate.title,
      description: savedTemplate.getDataValue('description') || "React to enter!",
      role: savedTemplate.roleId || null,
      duration: savedTemplate.duration,
      endsAt,
      participants: JSON.stringify([]),
      winnerCount: savedTemplate.winnerCount,
      extraFields: savedTemplate.extraFields
    });

    const embed = new EmbedBuilder()
        .setTitle(savedTemplate.title)
        .setDescription(savedTemplate.getDataValue('description') || "React to enter!")
        .setColor(isMiniboss ? "DarkRed" : "Gold") // ✅ Ensures Miniboss giveaways are styled differently
        .addFields(
            { name: "⏳ Ends In", value: `${Math.floor(savedTemplate.duration / 1000)}s`, inline: true },
            { name: "🏆 Winners", value: `${savedTemplate.winnerCount}`, inline: true },
            { name: "🎟️ Total Participants", value: `0 users`, inline: true }
        );

    // ✅ Preserve any saved `--field` values and prevent duplicates
    const extraFields = JSON.parse(savedTemplate.extraFields || "[]");
    extraFields.forEach((field: { name: string, value: string }) => {
      if (!embed.data.fields?.some(f => f.name === field.name)) {
        embed.addFields(field);
      }
    });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`join-${giveawayData.getDataValue('id')}`).setLabel(isMiniboss ? 'Join 🐲' : 'Join 🎉').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`leave-${giveawayData.getDataValue('id')}`).setLabel('Leave ❌').setStyle(ButtonStyle.Danger)
    );

    const giveawayMessage = await channel.send({
      content: savedTemplate.roleId ? `<@&${savedTemplate.roleId}>` : "",
      embeds: [embed],
      components: [row],
    });

    // ✅ Store message ID
    giveawayData.messageId = giveawayMessage.id;
    await giveawayData.save();

    // ✅ Start a live countdown
    await startLiveCountdown(giveawayData.getDataValue('id'), client);
    const ephemeralMessage = await channel.send(`✅ Giveaway started using template **${templateName}**, <@${message.author.id}>!`);
    setTimeout(() => ephemeralMessage.delete().catch(console.error), 5000);

  } catch (error) {
    console.error("❌ Error starting template giveaway:", error);
  }
}