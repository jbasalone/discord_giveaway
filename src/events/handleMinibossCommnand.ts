import {
    Client,
    Message,
    TextChannel,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Interaction
} from 'discord.js';

import { Giveaway } from '../models/Giveaway';
import { GuildSettings } from '../models/GuildSettings';

// ✅ Store restricted users in memory (temporary cache)
const restrictedUsers = new Map<string, string>(); // giveawayId -> restrictedUser

/**
 * Handles Miniboss Giveaway & Cooldown Detection.
 */
export async function handleMinibossCommand(
    client: Client,
    giveawayId: string | number,
    participants: string[]
) {
    giveawayId = String(giveawayId);
    console.log(`🔍 Handling Miniboss Giveaway: ${giveawayId}`);

    let giveaway = await Giveaway.findByPk(giveawayId);
    if (!giveaway) {
        console.error(`❌ Giveaway ${giveawayId} does not exist.`);
        return;
    }

    const hostId = giveaway.get("host");
    if (!hostId) {
        console.error(`❌ Could not determine the host.`);
        return;
    }

    const guild = client.guilds.cache.get(String(giveaway.get("guildId")));
    if (!guild) {
        console.error(`❌ Guild ${giveaway.get("guildId")} not found.`);
        return;
    }

    const channel = guild.channels.cache.get(String(giveaway.get("channelId"))) as TextChannel;
    if (!channel) {
        console.error(`❌ Invalid TextChannel.`);
        return;
    }

    // ✅ Fetch Miniboss Channel
    const guildSettings = await GuildSettings.findOne({ where: { guildId: guild.id } });
    const minibossChannelId = guildSettings?.get("minibossChannelId") as string;

    if (!minibossChannelId) {
        console.error(`❌ Miniboss channel ID missing for guild ${guild.id}`);
        return;
    }

    const minibossChannel = guild.channels.cache.get(minibossChannelId) as TextChannel;
    if (!minibossChannel) {
        console.error(`❌ Miniboss channel ${minibossChannelId} does not exist.`);
        return;
    }

    console.log(`📌 [DEBUG] Announcing Miniboss Winners in ${minibossChannelId}`);

    // ✅ **Exclude host from participant list immediately**
    let nonHostParticipants = participants.filter(id => id !== hostId);
    console.log(`👥 [DEBUG] Non-host Participants: ${nonHostParticipants.length} (Host Excluded)`);

    // ✅ **Function to send command buttons**
    async function sendCommandButtons() {
        const botId = "555955826880413696";
        const winnerMentions = nonHostParticipants.map(id => `<@${id}>`).join(" ");
        const commandText = `<@${botId}> miniboss ${winnerMentions}`;

        const initialRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`desktop-command-${giveawayId}`).setLabel("🖥️ Desktop Cmd").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`mobile-command-${giveawayId}`).setLabel("📱 Mobile Cmd").setStyle(ButtonStyle.Primary)
        );

        await minibossChannel.send({
            content: `⚔️ **Miniboss Ready!** ⚔️\n<@${hostId}>, use the commands below:`,
            components: [initialRow],
        });

        return commandText;
    }

    // ✅ **Always Announce Winners**
    await minibossChannel.send({
        content: `🎉 **Miniboss Giveaway Ended!** 🎉\n🏆 **Winners:** ${nonHostParticipants.map(id => `<@${id}>`).join(", ")}`,
    });

    const commandText = await sendCommandButtons();

    // ✅ **Cooldown & Overcap Message Detection**
    const restrictionCollector = minibossChannel.createMessageCollector({
        filter: (msg: Message) => {
            const isFromBot = msg.author.id === "555955826880413696";
            const isCooldown = msg.embeds.length > 0 && msg.embeds[0]?.title?.toLowerCase()?.includes("fight with a boss recently");
            const isOverCap = msg.content.toLowerCase().includes("you can't do this because") && msg.content.toLowerCase().includes("too many coins");
            const isMinibossWin = msg.embeds.length > 0 && msg.embeds[0]?.title?.includes("HAS BEEN DEFEATED!");
            if (isMinibossWin) {
                console.log(`🏆 Miniboss success detected! Ending restriction monitoring.`);
                restrictionCollector.stop();
            }
            return isFromBot && (isCooldown || isOverCap);
        },
        time: 600000,
    });

    restrictionCollector.on("collect", async (msg: Message) => {
        let restrictedUser = msg.embeds[0]?.author?.name?.split(" — ")[0] || msg.content.match(/you can't do this because (.+?) would have too many coins/i)?.[1];

        if (!restrictedUser) return;

        restrictedUsers.set(giveawayId, restrictedUser);

        const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`reroll-${giveawayId}`).setLabel("🔄 Reroll").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`give-1m-${giveawayId}`).setLabel("💰 Give 1 Minute").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`end-ga-${giveawayId}`).setLabel("❌ End Giveaway").setStyle(ButtonStyle.Danger)
        );

        await minibossChannel.send({
            content: `⚠️ <@${hostId}>, **${restrictedUser}** is restricted! Choose an action:`,
            components: [actionRow],
        });
    });

    // ✅ Button Handling
    const buttonCollector = minibossChannel.createMessageComponentCollector({ time: 300000 });

    buttonCollector.on("collect", async (interaction: Interaction) => {
        if (!interaction.isButton()) return;

        if (interaction.user.id !== hostId) {
            await interaction.reply({ content: "❌ You are **not the host**!", ephemeral: true });
            return;
        }

        await interaction.deferUpdate();

        if (interaction.customId.startsWith(`desktop-command-`) || interaction.customId.startsWith(`mobile-command-`)) {
            await interaction.followUp({
                content: interaction.customId.startsWith(`desktop-command-`) ? `\`\`\`${commandText}\`\`\`` : `${commandText}`,
                ephemeral: true,
            });
            return;
        }

        if (interaction.customId === `reroll-${giveawayId}`) {
            let restrictedUser = restrictedUsers.get(giveawayId);
            if (!restrictedUser) return;

            nonHostParticipants = nonHostParticipants.filter(id => !id.toLowerCase().includes(restrictedUser.toLowerCase()));

            await minibossChannel.send({
                content: `🔄 **New Winners:** ${nonHostParticipants.map(id => `<@${id}>`).join(", ")}`,
            });

            restrictedUsers.delete(giveawayId);
            await sendCommandButtons();
        }

        if (interaction.customId === `give-1m-${giveawayId}`) {
            await minibossChannel.send({ content: `⏳ **Waiting 1 minute...**` });

            setTimeout(async () => {
                await minibossChannel.send({
                    content: `⏳ **1 Minute is up!** <@${hostId}>, you can now reroll.`,
                    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(`reroll-${giveawayId}`).setLabel("🔄 Confirm Reroll").setStyle(ButtonStyle.Primary))],
                });
            }, 60000);
        }

        if (interaction.customId === `end-ga-${giveawayId}`) {
            await minibossChannel.send({ content: `❌ **Miniboss Giveaway has been canceled by the host.**` });
            buttonCollector.stop();
            restrictionCollector.stop();
        }
    });
}