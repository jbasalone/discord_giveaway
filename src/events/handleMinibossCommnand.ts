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
import { rerollWinnersByMessageId } from '../utils/rerollUtils';
import { incrementStat } from '../utils/userStats';

// ✅ Store restricted users in memory (temporary cache)
const restrictedUsers = new Map<string, Set<string>>();

export async function handleMinibossCommand(
    client: Client,
    giveawayId: string | number,
    participants: string[],
) {
    giveawayId = String(giveawayId);
    console.log(`🔍 Handling Miniboss Giveaway: ${giveawayId}`);
    let giveawayTerminated = false;

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
        if (giveawayTerminated) return; // ✅ Avoid repeating "⚔️ Miniboss Ready!"
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
        content: `🏆 **Winners:** ${finalWinners.map(id => `<@${id}>`).join(", ")}`,
    });

    for (const winnerId of finalWinners) {
        await incrementStat(winnerId, guild.id, 'won');
    }

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
            const isEnded = msg.content.includes("Miniboss Giveaway Ended!"); // ✅ detect end message content

            if (isMinibossWin || isEnded) {
                console.log(`🏁 Miniboss marked as ended. Stopping collectors and access.`);
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

        if (!restrictedUsers.has(giveawayId)) {
            restrictedUsers.set(giveawayId, new Set());
        }
        restrictedUsers.get(giveawayId)!.add(restrictedUser);

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
            const restrictedSet = restrictedUsers.get(giveawayId);
            if (!restrictedSet || restrictedSet.size === 0) return;

            const actualHostId = giveaway.get("host");
            const restrictedArray = Array.from(restrictedSet);

            // ❌ Filter out host from reroll list
            const safeRestricted = restrictedArray.filter(u => u !== actualHostId);
            if (safeRestricted.length === 0) {
                return minibossChannel.send(`⚠️ All restricted users are the host. Cannot reroll.`);
            }

            // 🚫 Filter final winners
            const updatedParticipants = finalWinners.filter(id => !safeRestricted.includes(id));
            if (updatedParticipants.length < 9) {
                return minibossChannel.send(`❌ Not enough valid participants remain after removing ${safeRestricted.length} restricted users.`);
            }

            // ✅ Execute reroll
            const newWinners = await rerollWinnersByMessageId(client, giveaway.get("messageId"));
            if (!newWinners.length) {
                return minibossChannel.send(`⚠️ Reroll failed. No eligible participants.`);
            }

            await minibossChannel.send(`🔄 **New Rerolled Winners:** ${newWinners.map(id => `<@${id}>`).join(", ")}`);

            // 🚪 Remove all restricted users from channel
            for (const userId of safeRestricted) {
                try {
                    const member = await minibossChannel.guild.members.fetch(userId).catch(() => null);
                    if (member) {
                        await minibossChannel.permissionOverwrites.edit(member, {
                            ViewChannel: false,
                            SendMessages: false
                        });
                    }
                } catch (e) {
                    console.warn(`⚠️ Could not revoke access from ${userId}:`, e);
                }
            }

            for (const userId of safeRestricted) {
                await incrementStat(userId, guild.id, 'rerolled');
            }

            // 🧼 Cleanup
            restrictedUsers.delete(giveawayId);
            await sendCommandButtons();
            await Giveaway.destroy({ where: { id: giveawayId } });
            console.log(`🔁 Rerolled after removing restricted users: ${safeRestricted.join(", ")}`);
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
            giveawayTerminated = true; // ✅ Stop future button reposts
            await minibossChannel.send({ content: `❌ **Miniboss Giveaway has been canceled by the host.**` });
            await updateChannelAccess(finalWinners, false);
            buttonCollector.stop();
            restrictionCollector.stop();
        }

    });
}