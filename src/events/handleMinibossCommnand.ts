import {
    Client,
    ButtonInteraction,
    TextChannel,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType
} from 'discord.js';
import { Giveaway } from '../models/Giveaway';
import { GuildSettings } from '../models/GuildSettings';
import { cache } from '../utils/giveawayCache';
import { Model } from 'sequelize';

// ✅ Prevent duplicate button responses
const interactionCache = new Set<string>();

/**
 * Handles the Miniboss giveaway logic after it ends.
 */
export async function handleMinibossCommand(client: Client, giveawayId: number, interaction?: ButtonInteraction) {
    console.log(`🔍 Handling Miniboss Giveaway: ${giveawayId}`);

    let giveaway = await Giveaway.findByPk(giveawayId);
    if (!giveaway) {
        console.log(`⚠️ Giveaway ${giveawayId} not found in database. Checking cache.`);
        giveaway = cache.get(String(giveawayId)); // ✅ Ensure cache is used
    }

    if (!giveaway) {
        console.error(`❌ Giveaway ${giveawayId} does not exist.`);
        if (interaction) {
            await interaction.reply({ content: "❌ This giveaway has ended and cannot be accessed.", ephemeral: true }).catch(() => {});
        }
        return;
    }

    const isSequelizeModel = giveaway instanceof Model;
    const guildId = isSequelizeModel ? giveaway.get("guildId") : giveaway.guildId;

    if (!guildId) {
        console.error(`❌ Missing guildId for giveaway ${giveawayId}`);
        return;
    }

    // ✅ Fetch the guild from the client cache
    const guild = client.guilds.cache.get(String(guildId));
    if (!guild) {
        console.error(`❌ Guild ${guildId} not found in cache.`);
        return;
    }

    let minibossChannelId: string | null = null;

    // ✅ Fetch `minibossChannelId` from `GuildSettings`
    const guildSettings = await GuildSettings.findOne({
        attributes: ['minibossChannelId'],
        where: { guildId: String(guildId) },
    });

    if (guildSettings) {
        minibossChannelId = guildSettings.get("minibossChannelId") as string | null;
    }

    if (!minibossChannelId || typeof minibossChannelId !== "string") {
        console.error(`❌ Invalid or missing Miniboss channel for guild ${guildId}`);
        return;
    }

    const minibossChannel = guild.channels.cache.get(minibossChannelId) as TextChannel;
    if (!minibossChannel) {
        console.error(`❌ Miniboss channel ${minibossChannelId} does not exist!`);
        return;
    }

    // ✅ Ensure winners list is always correct
    let participants: string[] = isSequelizeModel ? JSON.parse(giveaway.get("participants") ?? "[]") : giveaway.participants ?? [];

    // ✅ If no participants exist, fetch from cache before deletion
    if (!participants.length) {
        console.warn(`⚠️ No participants found in DB for giveaway ${giveawayId}, checking cache.`);
        const cachedData = cache.get(String(giveawayId));
        participants = cachedData?.participants ?? [];
    }

    // ✅ If participants are still empty, log a warning and avoid empty responses
    if (!participants.length) {
        console.error(`❌ Giveaway ${giveawayId} has no valid winners stored. Avoiding empty response.`);
        return;
    }

    let winners = participants.length > 0 ? participants.map(id => `<@${id}>`).join(", ") : "**No winners.**";

    // ✅ Preserve the command in memory to avoid issues when giveaway is deleted
    const mobileCommand = `<@555955826880413696> miniboss ${participants.map(id => `<@${id}>`).join(" ")}`;
    const desktopCommand = `<@555955826880413696> miniboss ${participants.map(id => `<@${id}>`).join(" ")}`;

    // ✅ Create buttons for Mobile & Desktop
    const desktopButton = new ButtonBuilder()
        .setCustomId(`miniboss-desktop-${giveawayId}`)
        .setLabel("Desktop Command")
        .setStyle(ButtonStyle.Primary);

    const mobileButton = new ButtonBuilder()
        .setCustomId(`miniboss-mobile-${giveawayId}`)
        .setLabel("Mobile Command")
        .setStyle(ButtonStyle.Success);

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(desktopButton, mobileButton);

    // ✅ Prevent duplicate messages by checking if a message has already been sent
    const cacheKey = `miniboss-message-${giveawayId}`;
    if (!cache.has(cacheKey)) {
        cache.set(cacheKey, true);

        await minibossChannel.send({
            content: `🎉 **Miniboss Giveaway Ended!** 🎉\n🏆 **Winners:** ${winners}`,
            components: [actionRow],
        });
    }

    // ✅ Handle button clicks (Mobile/Desktop)
    const filter = (i: ButtonInteraction) =>
        i.isButton() && (i.customId === `miniboss-mobile-${giveawayId}` || i.customId === `miniboss-desktop-${giveawayId}`);

    const collector = minibossChannel.createMessageComponentCollector({
        filter,
        componentType: ComponentType.Button,
        time: 600_000, // 10 minutes
    });

    collector.on("collect", async (buttonInteraction: ButtonInteraction) => {
        const isMobile = buttonInteraction.customId === `miniboss-mobile-${giveawayId}`;
        const commandText = isMobile ? mobileCommand : desktopCommand;

        // ✅ Prevent duplicate responses for the same interaction
        if (interactionCache.has(buttonInteraction.id)) {
            console.warn(`⚠️ Duplicate button press detected for giveaway ${giveawayId}, ignoring.`);
            return;
        }
        interactionCache.add(buttonInteraction.id);

        try {
            // ✅ Use `deferUpdate()` to acknowledge the interaction properly
            await buttonInteraction.deferUpdate().catch(() => {});

            // ✅ Prevent duplicate replies (only allow one response per button)
            await buttonInteraction.followUp({
                content: isMobile ? `${commandText}` : `🖥️ **Desktop Command:**\n\`\`\`${commandText}\`\`\``,
                ephemeral: true,
            }).catch(() => {});
        } catch (error) {
            console.error(`❌ Error handling button interaction for giveaway ${giveawayId}:`, error);
        }
    });

    collector.on("end", () => {
        console.log(`⏳ Button collector expired for giveaway ${giveawayId}`);
    });
}