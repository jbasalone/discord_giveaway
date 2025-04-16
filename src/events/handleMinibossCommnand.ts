
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
import { rerollWinnersByMessageId } from '../utils/rerollUtils';
import { incrementStat } from '../utils/userStats';

const restrictedUsers = new Map<string, Set<string>>();

export async function handleMinibossCommand(
    client: Client,
    giveawayId: string | number,
    participants: string[],
) {
    giveawayId = String(giveawayId);
    let giveawayTerminated = false;

    const giveaway = await Giveaway.findByPk(giveawayId);
    if (!giveaway) return console.error(`❌ Giveaway ${giveawayId} does not exist.`);

    const hostId = giveaway.get("host");
    const guild = await client.guilds.fetch(String(giveaway.get("guildId"))).catch(() => null);
    if (!guild) return console.error(`❌ Guild not found.`);

    const channel = guild.channels.cache.get(String(giveaway.get("channelId"))) as TextChannel;
    const settings = await GuildSettings.findOne({ where: { guildId: guild.id } });
    const minibossChannelId = settings?.get("minibossChannelId");
    if (!minibossChannelId) return console.error(`❌ Miniboss channel ID missing for guild ${guild.id}`);

    const minibossChannel = guild.channels.cache.get(minibossChannelId) as TextChannel;
    if (!minibossChannel) return console.error(`❌ Miniboss channel ${minibossChannelId} does not exist.`);

    const guaranteedWinners: string[] = JSON.parse(giveaway.get("guaranteedWinners") ?? "[]");
    const nonHost = participants.filter(p => p !== hostId);
    const finalWinners = [...new Set([...guaranteedWinners, ...nonHost])];

    const updateChannelAccess = async (users: string[], grant: boolean) => {
        for (const id of users) {
            await minibossChannel.permissionOverwrites.edit(id, {
                ViewChannel: grant,
                SendMessages: grant
            }).catch(console.warn);
        }
    };

    const sendCommandButtons = async () => {
        if (giveawayTerminated) return;
        const mentions = finalWinners.map(id => `<@${id}>`).join(" ");
        const botCmd = `<@555955826880413696> miniboss ${mentions}`;

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`desktop-command-${giveawayId}`).setLabel("🖥️ Desktop Cmd").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`mobile-command-${giveawayId}`).setLabel("📱 Mobile Cmd").setStyle(ButtonStyle.Primary),
        );

        await minibossChannel.send({
            content: `⚔️ **Miniboss Ready!** ⚔️\n<@${hostId}>, use the commands below:`,
            components: [row],
        });

        return botCmd;
    };

    await minibossChannel.send({
        content: `🏆 **Winners:** ${finalWinners.map(id => `<@${id}>`).join(", ")}`,
    });
    await updateChannelAccess(finalWinners, true);
    for (const id of finalWinners) await incrementStat(id, guild.id, 'won');

    const botCmd = await sendCommandButtons();

    const buttonCollector = minibossChannel.createMessageComponentCollector({ time: 20 * 60 * 1000 });
    const restrictionCollector = minibossChannel.createMessageCollector({ time: 20 * 60 * 1000 });

    restrictionCollector.on("collect", async (msg: Message) => {
        const isFromBot = msg.author.id === "555955826880413696";
        const isCooldown = msg.embeds?.[0]?.title?.toLowerCase().includes("fight with a boss recently");
        const isOverCap = msg.content.toLowerCase().includes("too many coins");
        const isCancelled = msg.content.toLowerCase().includes("epic rpg miniboss event cancelled");
        const isEnded = msg.content.includes("Miniboss Giveaway Ended!") ||
            msg.embeds?.[0]?.title?.includes("HAS BEEN DEFEATED!");

        if (isCancelled) {
            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId(`desktop-command-${giveawayId}`).setLabel("🖥️ Desktop Cmd").setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`mobile-command-${giveawayId}`).setLabel("📱 Mobile Cmd").setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`end-ga-${giveawayId}`).setLabel("⛔ End Giveaway").setStyle(ButtonStyle.Danger)
            );
            await minibossChannel.send({
                content: `⚠️ **The Miniboss event was cancelled.** <@${hostId}>, please choose how to proceed.`,
                components: [row]
            });

            setTimeout(async () => {
                if (!giveawayTerminated) {
                    await minibossChannel.send("🕒 **No action taken. Cleaning up access.**");
                    await updateChannelAccess(finalWinners, false);
                    restrictionCollector.stop();
                    buttonCollector.stop();
                }
            }, 20 * 60 * 1000);
        }

        if (isEnded) {
            await updateChannelAccess(finalWinners, false);
            restrictionCollector.stop();
            buttonCollector.stop();
            return;
        }

        if (isFromBot && (isCooldown || isOverCap)) {
            let restrictedUser = null;
            const embedAuthor = msg.embeds?.[0]?.author?.name || "";
            const match = embedAuthor.match(/^(.+?) — cooldown/);
            if (match) restrictedUser = match[1];
            const overCapMatch = msg.content.match(/you can't do this because (.+?) would have too many coins/i);
            if (overCapMatch) restrictedUser = overCapMatch[1];

            if (!restrictedUser) return;

            if (!restrictedUsers.has(giveawayId)) restrictedUsers.set(giveawayId, new Set());
            restrictedUsers.get(giveawayId)!.add(restrictedUser);

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId(`reroll-${giveawayId}`).setLabel("🔄 Reroll").setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`give-1m-${giveawayId}`).setLabel("⏲️ Give 1 Minute").setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`end-ga-${giveawayId}`).setLabel("⛔ End Giveaway").setStyle(ButtonStyle.Danger)
            );

            await minibossChannel.send({
                content: `⚠️ <@${hostId}>, **${restrictedUser}** is stalling the event. Choose an action:`,
                components: [row],
            });
        }
    });

    buttonCollector.on("collect", async (i: Interaction) => {
        if (!i.isButton()) return;
        await i.deferUpdate();
        const id = i.customId;

        if (id.startsWith("desktop-command-") || id.startsWith("mobile-command-")) {
            if (i.user.id !== hostId) {
                return i.followUp({ content: "⛔ Only the host can use these.", ephemeral: true });
            }
            return i.followUp({ content: id.startsWith("desktop") ? `\`\`\`${botCmd}\`\`\`` : botCmd, ephemeral: true });
        }

        if (id === `end-ga-${giveawayId}`) {
            giveawayTerminated = true;
            await minibossChannel.send("❌ **Giveaway canceled by host.**");
            await updateChannelAccess(finalWinners, false);
            buttonCollector.stop();
            restrictionCollector.stop();
        }

        if (id === `give-1m-${giveawayId}`) {
            const restrictedSet = restrictedUsers.get(giveawayId);
            if (!restrictedSet || restrictedSet.size === 0) return;
            const firstUser = Array.from(restrictedSet)[0];

            await minibossChannel.send(`⏳ <@${hostId}>, **${firstUser}** has **1 more minute** to proceed...`);

            setTimeout(async () => {
                const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder().setCustomId(`reroll-${giveawayId}`).setLabel("🔄 Reroll").setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`give-1m-${giveawayId}`).setLabel("⏲️ Give 1 Minute").setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`end-ga-${giveawayId}`).setLabel("⛔ End Giveaway").setStyle(ButtonStyle.Danger)
                );
                await minibossChannel.send({
                    content: `⏳ **Time's up!** <@${hostId}>, choose an action for **${firstUser}**:`,
                    components: [row]
                });
            }, 60000);
        }

        if (id === `reroll-${giveawayId}`) {
            const restrictedSet = restrictedUsers.get(giveawayId);
            if (!restrictedSet || restrictedSet.size === 0) return;
            const restrictedArray = Array.from(restrictedSet).filter(u => u !== hostId);

            if (restrictedArray.length === 0) return minibossChannel.send("⚠️ Cannot reroll host.");

            const remaining = finalWinners.filter(id => !restrictedArray.includes(id));
            if (remaining.length < 9) return minibossChannel.send("❌ Not enough remaining participants.");

            const newWinners = await rerollWinnersByMessageId(client, giveaway.get("messageId"));
            if (!newWinners.length) return minibossChannel.send("⚠️ Reroll failed. No eligible participants.");

            await minibossChannel.send(`🔄 **New Rerolled Winners:** ${newWinners.map(id => `<@${id}>`).join(", ")}`);

            for (const uid of restrictedArray) {
                await minibossChannel.permissionOverwrites.edit(uid, {
                    ViewChannel: false,
                    SendMessages: false
                }).catch(() => {});
                await incrementStat(uid, guild.id, 'rerolled');
            }

            restrictedUsers.delete(giveawayId);
            await sendCommandButtons();
            await Giveaway.destroy({ where: { id: giveawayId } });
        }
    });
}
