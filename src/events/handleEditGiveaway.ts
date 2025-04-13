import { ButtonInteraction, Message, DMChannel } from "discord.js";
import { Giveaway } from "../models/Giveaway";
import { convertToMilliseconds } from "../utils/convertTime";

export async function handleEditGiveaway(interaction: ButtonInteraction) {
    if (!interaction.customId.startsWith("edit-giveaway-")) return;

    const giveawayId = interaction.customId.split("-").pop();
    const user = interaction.user;

    // ✅ Find giveaway in the database
    const giveaway = await Giveaway.findByPk(giveawayId);
    if (!giveaway) return interaction.reply({ content: "❌ Giveaway not found.", ephemeral: true });

    // ✅ Ensure the giveaway is still pending
    if (giveaway.status !== "pending") {
        return interaction.reply({ content: "❌ You can only edit pending giveaways.", ephemeral: true });
    }

    try {
        await interaction.reply({ content: "📩 **Check your DMs to edit your giveaway.**", ephemeral: true });
        const dm = await user.createDM();

        const askQuestion = async (question: string, current: string): Promise<string> => {
            await dm.send(`${question}\n(Current: **${current}**)`);
            const collected = await dm.awaitMessages({ max: 1, time: 60000 });
            return collected.first()?.content || current;
        };

        // ✅ Ask user for edits (show current values)
        const title = await askQuestion("📋 **Enter the new title of your giveaway:**", giveaway.title);
        const durationInput = await askQuestion("⏳ **Enter the new duration (e.g., `30m`, `1h`, `1d`):**", `${giveaway.duration / 1000}s`);
        const winnerCount = parseInt(await askQuestion("🏆 **Enter the new number of winners:**", String(giveaway.winnerCount))) || 1;
        const roleRestriction = await askQuestion("🔒 **Enter a new restricted role (or type `none`):**", giveaway.roleRestriction || "none");
        const extraFields = await askQuestion("📄 **Add any extra details (or type `none`):**", giveaway.extraFields || "none");

        // ✅ Convert duration to milliseconds
        const durationMs = convertToMilliseconds(durationInput);
        if (!durationMs) return dm.send("❌ Invalid duration format. Giveaway edit canceled.");

        // ✅ Update database
        await giveaway.update({
            title,
            duration: durationMs,
            winnerCount,
            roleRestriction: roleRestriction === "none" ? null : roleRestriction,
            extraFields,
            endsAt: Math.floor(Date.now() / 1000) + Math.floor(durationMs / 1000),
        });

        await dm.send("✅ **Your giveaway has been successfully updated!**");
    } catch (error) {
        console.error(error);
        interaction.reply({ content: "❌ Failed to edit giveaway.", ephemeral: true });
    }
}