import {
    Client,
    Message,
    TextChannel,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Interaction,
    PermissionsBitField
} from 'discord.js';

import { Giveaway } from '../models/Giveaway';
import { GuildSettings } from '../models/GuildSettings';

// ✅ Store restricted users in memory (temporary cache)
const restrictedUsers = new Map<string, string>();

export async function handleMinibossCommand(
    client: Client,
    giveawayId: string | number,
    participants: string[],
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

    const guildSettings = await GuildSettings.findOne({where: {guildId: guild.id}});
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

    let nonHostParticipants = participants.filter(id => id !== hostId);
    console.log(`👥 [DEBUG] Non-host Participants: ${nonHostParticipants.length} (Host Excluded)`);

    // ✅ Retrieve Guaranteed Winners
    let guaranteedWinners: string[] = JSON.parse(giveaway.get("guaranteedWinners") ?? "[]");
    console.log(`🔒 Guaranteed Winners for Giveaway ${giveawayId}:`, guaranteedWinners);

    // ✅ Merge guaranteed winners with participants, avoiding duplicates
    let finalWinners = [...new Set([...guaranteedWinners, ...nonHostParticipants])];

    async function updateChannelAccess(users: string[], grant: boolean) {
        for (const userId of users) {
            try {
                await minibossChannel.permissionOverwrites.edit(userId, {
                    ViewChannel: grant,
                    SendMessages: grant
                });
                console.log(`🔑 [DEBUG] ${grant ? "Granted" : "Removed"} channel access for ${userId}`);
            } catch (error) {
                console.error(`❌ Error updating channel permissions for ${userId}:`, error);
            }
        }
    }

    let commandText = "";

    async function sendCommandButtons() {
        const botId = "555955826880413696";
        const winnerMentions = finalWinners.map(id => `<@${id}>`).join(" ");
        commandText = `<@${botId}> miniboss ${winnerMentions}`;

        const initialRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`desktop-command-${giveawayId}`).setLabel("🖥️ Desktop Cmd").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`mobile-command-${giveawayId}`).setLabel("📱 Mobile Cmd").setStyle(ButtonStyle.Primary)
        );

        await minibossChannel.send({
            content: `⚔️ **Miniboss Ready!** ⚔️\n<@${hostId}>, use the commands below:`,
            components: [initialRow],
        });

        console.log(`✅ [DEBUG] Stored commandText: ${commandText}`);
    }

    await minibossChannel.send({
        content: `🎉 **Miniboss Giveaway Ended!** 🎉\n🏆 **Winners:** ${finalWinners.map(id => `<@${id}>`).join(", ")}`,
    });

    await updateChannelAccess(finalWinners, true);
    await sendCommandButtons();

    const restrictionCollector = minibossChannel.createMessageCollector({
        filter: (msg: Message) => {
            console.log(`📌 [DEBUG] Checking message for restrictions:`, msg.content, msg.author.id);

            const isFromBot = msg.author.id === "555955826880413696";
            const isCooldown = msg.embeds.length > 0 && msg.embeds[0]?.title?.toLowerCase()?.includes("fight with a boss recently");
            const isOverCap = msg.content.toLowerCase().includes("you can't do this because") &&
                msg.content.toLowerCase().includes("too many coins");
            const isMinibossWin = msg.embeds.length > 0 && msg.embeds[0]?.title?.includes("HAS BEEN DEFEATED!");

            if (isMinibossWin) {
                console.log(`🏆 Miniboss success detected! Revoking access & ending process.`);
                updateChannelAccess(finalWinners, false);
                restrictionCollector.stop();
                return false;
            }

            return isFromBot && (isCooldown || isOverCap);
        },
        time: 600000,
    });

    restrictionCollector.on("collect", async (msg: Message) => {
        console.log(`🔍 Restriction Detected! Processing action...`);

        let restrictedUser = null;
        if (msg.embeds.length > 0) {
            const embedAuthor = msg.embeds[0].author?.name || "";
            const match = embedAuthor.match(/^(.+?) — cooldown/);
            if (match) {
                restrictedUser = match[1];
            }
        }
        const overCapMatch = msg.content.match(/you can't do this because (.+?) would have too many coins/i);
        if (overCapMatch) {
            restrictedUser = overCapMatch[1];
        }

        if (!restrictedUser) return;

        restrictedUsers.set(giveawayId, restrictedUser);

        const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`reroll-${giveawayId}`).setLabel("🔄 Reroll").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`give-1m-${giveawayId}`).setLabel("⏲️ Give 1 Minute").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`end-ga-${giveawayId}`).setLabel("⛔ End Giveaway").setStyle(ButtonStyle.Danger)
        );

        await minibossChannel.send({
            content: `⚠️ <@${hostId}>, **${restrictedUser}** is holding us all up Choose an action:`,
            components: [actionRow],
        });
    });

    const buttonCollector = minibossChannel.createMessageComponentCollector({time: 300000});

    buttonCollector.on("collect", async (interaction: Interaction) => {
        if (!interaction.isButton()) return;
        await interaction.deferUpdate();

        if (interaction.customId.startsWith(`desktop-command-`) || interaction.customId.startsWith(`mobile-command-`)) {
            await interaction.followUp({
                content: interaction.customId.startsWith(`desktop-command-`)
                    ? `\`\`\`${commandText}\`\`\``
                    : `${commandText}`,
                ephemeral: true,
            });
            return;
        }

        if (interaction.customId === `reroll-${giveawayId}`) {
            let restrictedUser = restrictedUsers.get(giveawayId);
            if (!restrictedUser) return;

            const forceEnabled = Boolean(giveaway.get("forceStart")); // ✅ Ensure correct boolean handling
            const actualHostId = giveaway.get("host"); // ✅ Ensure correct host ID is used

            console.log(`📌 [DEBUG] Checking if restricted user (${restrictedUser}) is the host (${actualHostId})`);

            // ❌ **If the restricted user is the host, warn them instead of rerolling**
            if (restrictedUser === actualHostId) {
                await minibossChannel.send({
                    content: `⚠️ **<@${actualHostId}>, you are the host and cannot be rerolled!**\nPlease resolve your issue immediately.`,
                });
                return;
            }

            // ✅ **Count non-host participants AFTER removing the restricted user**
            const updatedParticipants = finalWinners.filter(id => id !== restrictedUser);
            const remainingCount = updatedParticipants.length;

            console.log(`📌 [DEBUG] Non-host participant count after removing restricted user: ${remainingCount}`);

            // ❌ **If there are fewer than 9 non-host participants, deny reroll (even with --force)**
            if (remainingCount < 9) {
                await minibossChannel.send({
                    content: `❌ **Reroll is not possible!** A **Miniboss requires at least 9  participants.**\n either give time or end the miniboss.`,
                });
                return;
            }

            // ✅ **Proceed with rerolling only if there are 10 or more non-host participants**
            finalWinners = updatedParticipants; // Remove restricted user

            await minibossChannel.send({
                content: `🔄 **New Winners:** ${finalWinners.map(id => `<@${id}>`).join(", ")}`,
            });

            // ✅ **Ensure we only update permissions for non-host participants**
            if (restrictedUser !== actualHostId) {
                try {
                    const member = await minibossChannel.guild.members.fetch(restrictedUser).catch(() => null);
                    if (member) {
                        await minibossChannel.permissionOverwrites.edit(member, {
                            ViewChannel: false,
                            SendMessages: false
                        });
                        console.log(`🔑 [DEBUG] Removed channel access for ${restrictedUser}`);
                    } else {
                        console.warn(`⚠️ [DEBUG] Member ${restrictedUser} not found in guild. Skipping permission update.`);
                    }
                } catch (error) {
                    console.error(`❌ Error updating channel permissions for ${restrictedUser}:`, error);
                }
            }

            restrictedUsers.delete(giveawayId);
            await sendCommandButtons(); // Re-send command buttons
        }

        if (interaction.customId === `give-1m-${giveawayId}`) {
            let restrictedUser = restrictedUsers.get(giveawayId);
            if (!restrictedUser) return;

            await minibossChannel.send({
                content: `⏳ <@${hostId}>, **${restrictedUser}** has **1 more minute** to proceed...`,
            });

            // ✅ Start 1-minute timeout
            setTimeout(async () => {
                const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder().setCustomId(`reroll-${giveawayId}`).setLabel("🔄 Reroll").setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`give-1m-${giveawayId}`).setLabel("⏲️ Give 1 Minute").setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`end-ga-${giveawayId}`).setLabel("⛔ End Giveaway").setStyle(ButtonStyle.Danger)
                );

                await minibossChannel.send({
                    content: `⏳ **Time's up!** <@${hostId}>, choose an action for **${restrictedUser}**:`,
                    components: [actionRow],
                });
            }, 60000); // 60 seconds delay
        }

        if (interaction.customId === `end-ga-${giveawayId}`) {
            await minibossChannel.send({content: `❌ **Miniboss Giveaway has been canceled by the host.**`});
            await updateChannelAccess(finalWinners, false);
            buttonCollector.stop();
            restrictionCollector.stop();
        }
    });
}