import { Message, DMChannel, TextChannel } from "discord.js";
import { Giveaway } from "../models/Giveaway";
import { convertToMilliseconds } from "../utils/convertTime";

export async function execute(message: Message) {
    if (!message.guild) return message.reply("❌ This command must be used inside a server.");

    const user = message.author;
    const guildId = message.guild.id;
    const hostId = user.id;
    const channelId = message.channel.id;

    try {
        // ✅ Start DM conversation
        const dm = await user.createDM();

        const askQuestion = async (question: string): Promise<string> => {
            await dm.send(question);

            const collected = await dm.awaitMessages({
                filter: (msg) => msg.author.id === user.id, // ✅ Ensures only user's response is accepted
                max: 1,
                time: 60000,
                errors: ["time"]
            });

            return collected.first()?.content?.trim() || "none";
        };

        // ✅ Ask questions one by one, moving forward immediately after response
        const title = await askQuestion("📋 **Enter the title of your giveaway:**");
        const durationInput = await askQuestion("⏳ **Enter the duration (e.g., `30m`, `1h`, `1d`):**");
        const winnerCount = parseInt(await askQuestion("🏆 **Enter the number of winners:**")) || 1;
        const roleRestriction = await askQuestion("🔒 **Enter a restricted role (or type `none`):**");
        const extraFields = await askQuestion("📄 **Add any extra details (or type `none`):**");

        // ✅ Convert duration to milliseconds
        const durationMs = convertToMilliseconds(durationInput);
        if (!durationMs) {
            await dm.send("❌ Invalid duration format. Giveaway submission canceled.");
            return;
        }

        // ✅ Calculate `endsAt` timestamp
        const endsAt = Math.floor(Date.now() / 1000) + Math.floor(durationMs / 1000);

        // ✅ Create a pending giveaway entry
        const giveaway = await Giveaway.create({
            guildId,
            host: hostId,
            channelId,
            messageId: "PENDING",
            title,
            description: `Hosted by <@${hostId}>`,
            type: "custom",
            duration: durationMs,
            endsAt,
            participants: "[]",
            winnerCount,
            extraFields,
            status: "pending",
            userId: hostId,
            roleRestriction: roleRestriction === "none" ? null : roleRestriction,
        });

        await dm.send("✅ **Your giveaway has been successfully submitted and is awaiting approval!**");
    } catch (error) {
        console.error(error);
        message.reply("❌ Failed to submit giveaway.");
    }
}