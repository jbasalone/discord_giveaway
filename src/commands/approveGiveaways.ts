import { ButtonInteraction, EmbedBuilder, TextChannel } from "discord.js";
import { Giveaway } from "../models/Giveaway";

export async function handleGiveawayApproval(interaction: ButtonInteraction) {
    if (!interaction.customId.startsWith("approve-giveaway-") && !interaction.customId.startsWith("reject-giveaway-")) return;

    const giveawayId = interaction.customId.split("-").pop();
    const giveaway = await Giveaway.findByPk(giveawayId);

    if (!giveaway) return interaction.reply({ content: "Giveaway not found.", ephemeral: true });

    if (interaction.customId.startsWith("approve-giveaway-")) {
        giveaway.status = "approved";
        await Giveaway.update({ status: "approved" }, { where: { id: giveaway.id } });

        // ✅ Ensure channel exists and is a TextChannel
        const channel = interaction.client.channels.cache.get("YOUR_GIVEAWAY_CHANNEL_ID");
        if (channel && channel.isTextBased() && "send" in channel) {
            await channel.send({ content: `🎉 **${giveaway.title}** is now live!` });
            setTimeout(async () => {
                await interaction.reply({ content: `✅ Giveaway **"${giveaway.title}"** approved!`, ephemeral: true });
            }, 1000);
        } else {
            console.error("❌ Giveaway announcement channel not found or is invalid.");
        }

        await interaction.reply({ content: `✅ Giveaway **"${giveaway.title}"** approved!`, ephemeral: true });
    } else {
        giveaway.status = "rejected";
        await giveaway.save();

        // ✅ Notify user of rejection
        try {
            const user = await interaction.client.users.fetch(giveaway.userId);
            try {
                await user.send(`❌ Your giveaway **"${giveaway.title}"** has been rejected.`);
            } catch (error) {
                console.error("Failed to send DM. User might have DMs disabled.");
            }
        } catch (error) {
            console.error("Failed to send DM to user:", error);
        }

        await interaction.reply({ content: `❌ Giveaway **"${giveaway.title}"** rejected.`, ephemeral: true });
    }
}