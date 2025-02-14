import { ButtonInteraction } from 'discord.js';
import { Giveaway } from '../models/Giveaway';
import { cache } from '../utils/giveawayCache';

/**
 * Handles the Miniboss command selection interaction.
 */
export async function handleMinibossCommand(interaction: ButtonInteraction) {
    if (!interaction.isButton()) return;

    const customId = interaction.customId;
    const isMobile = customId.includes("mobile");
    const giveawayId = customId.split("-").pop();

    if (!giveawayId) {
        return interaction.reply({ content: "❌ Invalid Giveaway ID.", ephemeral: true });
    }

    // ✅ Check the Cache First (If Giveaway is Deleted)
    let giveaway = await Giveaway.findByPk(giveawayId);
    if (!giveaway) {
        console.log(`⚠️ Giveaway ${giveawayId} not found in database. Checking cache.`);
        giveaway = cache.get(giveawayId); // Retrieve from cache
    }

    if (!giveaway) {
        return interaction.reply({ content: "❌ Giveaway has ended, and no data is available.", ephemeral: true });
    }

    // ✅ Handle Sequelize Model vs Cached Object
    const isSequelizeModel = typeof giveaway.get === "function";
    const participants = isSequelizeModel ? JSON.parse(giveaway.get("participants") ?? "[]") : giveaway.participants ?? [];

    if (!Array.isArray(participants) || participants.length === 0) {
        return interaction.reply({ content: "❌ No winners available for this giveaway.", ephemeral: true });
    }

    const forceMode = isSequelizeModel ? giveaway.get("forceStart") ?? false : giveaway.forceStart ?? false;
    const numWinners = forceMode ? participants.length : 9;
    const shuffledParticipants = [...participants].sort(() => Math.random() - 0.5);
    const winnersList = shuffledParticipants.slice(0, numWinners);

    // ✅ Generate Correct Miniboss Command
    let command;
    if (isMobile) {
        command = `<@555955826880413696> miniboss ${winnersList.map(id => `<@${id}>`).join(' ')}`;
    } else {
        command = `<@555955826880413696> miniboss ${winnersList.map(id => `<@${id}>`).join(' ')}`;
    }

    await interaction.reply({
        content: `**Copy & Paste This:**\n\`${command}\``,
        ephemeral: true
    });
}