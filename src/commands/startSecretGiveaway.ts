import {
    Message,
    Guild,
    TextChannel,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionsBitField
} from "discord.js";
import { Giveaway } from "../models/Giveaway";
import { startLiveCountdown } from "../utils/giveawayTimer";
import { client } from "../index";
import { SecretGiveawaySettings } from "../models/SecretGiveaway";

export async function execute(message: Message, rawArgs: string[]) {
    if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply("❌ You need **Administrator** permissions to start secret giveaways.");
    }

    const guild = message.guild;
    if (!guild) return message.reply("❌ This command must be used inside a server.");

    // ✅ **Fetch Server Settings**
    const settings = await SecretGiveawaySettings.findOne({ where: { guildId: guild.id } });
    if (!settings || !settings.get("enabled")) {
        return message.reply("❌ Secret giveaways are not enabled on this server.");
    }

    // ✅ **Extract & Validate Arguments**
    const maxWinners = parseInt(rawArgs[0]) || 5;
    const durationHours = parseInt(rawArgs[1]) || 48;
    const messageContent = rawArgs.slice(2).join(" ") || "A secret giveaway is happening right now!";

    if (maxWinners < 1 || durationHours < 1) {
        return message.reply("❌ Invalid arguments! Example usage: `!ga secret 10 48 \"Hidden giveaway message!\"`");
    }

    console.log(`🎭 Starting Secret Giveaway: ${maxWinners} Winners, ${durationHours} Hours.`);

    await startSecretGiveaway(guild, maxWinners, durationHours, messageContent);
    return message.reply(`✅ **Secret Giveaway Started!**\n- 🏆 **Winners:** ${maxWinners}\n- ⏳ **Duration:** ${durationHours} Hours`);
}

// ✅ **Secret Giveaway Scheduler**
async function startSecretGiveaway(guild: Guild, maxWinners: number, durationHours: number, messageContent: string) {
    try {
        console.log("🔍 **Scheduling Secret Giveaway Messages...**");

        // ✅ **Get Allowed Channels from Categories**
        const settings = await SecretGiveawaySettings.findOne({ where: { guildId: guild.id } });
        if (!settings || !settings.get("enabled")) {
            console.error("❌ Secret giveaways are not enabled for this server.");
            return;
        }

        const categoryIds: string[] = JSON.parse(settings.get("categoryIds") ?? "[]");
        const channels = guild.channels.cache
            .filter((channel) => categoryIds.includes(channel.parentId || "") && channel.isTextBased())
            .map((channel) => channel.id);

        if (channels.length === 0) {
            console.error("❌ No channels found in the configured categories.");
            return;
        }

        console.log(`✅ Found ${channels.length} eligible channels for secret messages.`);

        // ✅ **Determine Total Messages to Send**
        const totalMessages = maxWinners * 3; // Send 3x more messages than winners
        const now = Date.now();
        const endTime = now + durationHours * 60 * 60 * 1000;

        let scheduledMessages: { channelId: string; sendTime: number }[] = [];

        for (let i = 0; i < totalMessages; i++) {
            const randomTime = Math.floor(Math.random() * (endTime - now)) + now;
            const randomChannel = channels[Math.floor(Math.random() * channels.length)];
            scheduledMessages.push({ channelId: randomChannel, sendTime: randomTime });
        }

        // ✅ **Sort messages by time**
        scheduledMessages.sort((a, b) => a.sendTime - b.sendTime);

        console.log(`📌 Scheduled ${scheduledMessages.length} messages over ${durationHours} hours.`);

        // ✅ **Start Scheduler**
        checkForScheduledMessages(scheduledMessages, maxWinners, messageContent);
    } catch (error) {
        console.error("❌ Error scheduling Secret Giveaway messages:", error);
    }
}

// ✅ **Monitor Scheduled Messages & Send at Randomized Intervals**
async function checkForScheduledMessages(
    scheduledMessages: { channelId: string; sendTime: number }[],
    maxWinners: number,
    messageContent: string
) {
    setInterval(async () => {
        const now = Date.now();
        for (let i = 0; i < scheduledMessages.length; i++) {
            if (scheduledMessages[i].sendTime <= now) {
                const { channelId } = scheduledMessages[i];
                const channel = client.channels.cache.get(channelId) as TextChannel;
                if (channel) {
                    await sendSecretGiveawayMessage(channel, maxWinners, messageContent);
                }
                scheduledMessages.splice(i, 1);
                i--;
            }
        }
    }, 30_000);
}

// ✅ **Send Secret Giveaway Message**
async function sendSecretGiveawayMessage(channel: TextChannel, maxWinners: number, messageContent: string) {
    try {
        console.log(`📨 Sending Secret Giveaway to #${channel.name}`);

        const embed = new EmbedBuilder()
            .setTitle("🕵 **Secret Giveaway** 🕵")
            .setDescription(messageContent)
            .setColor("Purple")
            .setFields([
                { name: "🔒 Secret Location", value: "This giveaway is **exclusive** to this channel!", inline: false },
                { name: "🏆 Guaranteed Winners", value: `${maxWinners} people`, inline: true },
                { name: "⏳ Ends Soon", value: "Be quick! First Come First Win!", inline: true }
            ]);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`secret-join`).setLabel("Join 🎉").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`secret-ignore`).setLabel("Ignore ❌").setStyle(ButtonStyle.Secondary)
        );

        const secretMessage = await channel.send({ embeds: [embed], components: [row] });

        // ✅ **Save Giveaway in Database**
        const giveawayData = await Giveaway.create({
            guildId: channel.guild.id,
            host: client.user?.id || "Bot",
            channelId: channel.id,
            messageId: secretMessage.id,
            title: "Secret Giveaway",
            description: "A hidden giveaway has started in this channel!",
            type: "secret",
            duration: 60000,
            endsAt: Math.floor(Date.now() / 1000) + 60,
            participants: JSON.stringify([]),
            winnerCount: maxWinners,
            extraFields: JSON.stringify({ isSecret: true }),
            forceStart: true
        });

        startLiveCountdown(giveawayData.id, client);
        console.log(`✅ Secret Giveaway sent in #${channel.name}`);

        // ✅ **Set Timeout to Remove Buttons**
        setTimeout(async () => {
            try {
                const expiredEmbed = EmbedBuilder.from(secretMessage.embeds[0])
                    .setColor("DarkGrey")
                    .setFields([
                        { name: "⏳ Giveaway Expired", value: "This giveaway has ended." }
                    ]);

                await secretMessage.edit({ embeds: [expiredEmbed], components: [] });
                console.log(`🚫 Secret Giveaway Buttons Removed in #${channel.name}`);
            } catch (error) {
                console.error("❌ Error removing giveaway buttons:", error);
            }
        }, 60000); //

    } catch (error) {
        console.error("❌ Error sending Secret Giveaway:", error);
    }
}