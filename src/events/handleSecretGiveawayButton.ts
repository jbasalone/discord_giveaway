import { ButtonInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { Giveaway } from "../models/Giveaway";

export async function handleSecretGiveawayButton(interaction: ButtonInteraction) {
    const { customId, user, guildId, message } = interaction;
    if (!guildId) return;

    console.log(`🔍 [DEBUG] Button Pressed: ${customId} by ${user.username}`);

    // ✅ **Find Giveaway Based on Message ID**
    const giveaway = await Giveaway.findOne({
        where: { messageId: message.id, type: "secret" }
    });

    if (!giveaway) {
        return interaction.reply({ content: "❌ Giveaway not found!", ephemeral: true });
    }

    // ✅ **Ensure Participants Are Tracked Properly**
    let participants: string[] = JSON.parse(giveaway.get("participants") ?? "[]");

    if (customId === "secret-join") {
        // ✅ **Check if User Already Joined**
        if (participants.includes(user.id)) {
            return interaction.reply({ content: "⚠️ You've already joined this giveaway!", ephemeral: true });
        }

        // ✅ **Check if Giveaway Is Full**
        const maxWinners = giveaway.get("winnerCount");
        if (participants.length >= maxWinners) {
            return interaction.reply({ content: "❌ The giveaway has reached its max winners!", ephemeral: true });
        }

        // ✅ **Add User as Guaranteed Winner**
        participants.push(user.id);
        giveaway.set("participants", JSON.stringify(participants));
        await giveaway.save();

        console.log(`🎉 [WINNER ADDED] ${user.username} joined the secret giveaway!`);

        // ✅ **Disable Buttons After Joining**
        const updatedRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId("secret-join").setLabel("✅ Joined").setStyle(ButtonStyle.Secondary).setDisabled(true),
            new ButtonBuilder().setCustomId("secret-ignore").setLabel("❌ Ignored").setStyle(ButtonStyle.Secondary).setDisabled(true)
        );

        await interaction.update({ components: [updatedRow] });

        return interaction.reply({ content: "🎉 You have joined the **Secret Giveaway**! Check back later to see if you won!", ephemeral: true });

    } else if (customId === "secret-ignore") {
        console.log(`🚫 [IGNORED] ${user.username} ignored the secret giveaway.`);

        // ✅ **Disable Buttons When Ignored**
        const updatedRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId("secret-join").setLabel("✅ Joined").setStyle(ButtonStyle.Secondary).setDisabled(true),
            new ButtonBuilder().setCustomId("secret-ignore").setLabel("❌ Ignored").setStyle(ButtonStyle.Secondary).setDisabled(true)
        );

        await interaction.update({ components: [updatedRow] });

        return interaction.reply({ content: "🔕 You ignored this giveaway.", ephemeral: true });
    }
}