import {
    Message,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ModalSubmitInteraction,
    TextChannel,
    StringSelectMenuInteraction,
    Interaction,
    CacheType,
} from 'discord.js';
import { BugReport } from '../models/BugReport';
import { client } from '../index';

const BUG_TRACKER_CHANNEL_ID = "1343109399111274536"; // ✅ Replace with actual bug tracker channel ID

/** 📜 Main Bug Tracker Command */
export async function execute(message: Message) {
    console.log(`🔍 Command Executed: "bug" by ${message.author.tag}`);

    try {
        const embed = new EmbedBuilder()
            .setTitle("📜 Bug & Feature Tracker")
            .setDescription("Please select an option below to report an issue or request a feature.")
            .setColor("Blue");

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId("report-menu")
                .setPlaceholder("📜 Select an option...")
                .addOptions(
                    { label: "🐞 Report a Bug", value: "report-bug" },
                    { label: "💡 Request a Feature", value: "report-feature" }
                )
        );

        await message.reply({ embeds: [embed], components: [row] });

    } catch (error) {
        console.error("❌ Error displaying report menu:", error);
        return message.reply("❌ An error occurred while opening the report menu.");
    }
}

/** 🎯 Handle Selection from Dropdown */
export async function handleReportSelection(interaction: StringSelectMenuInteraction) {
    console.log(`🔍 [DEBUG] Dropdown selection: ${interaction.values[0]}`);

    await interaction.deferUpdate().catch(() => {}); // ✅ Acknowledge interaction to prevent timeout

    const selection = interaction.values?.[0];
    if (!selection) return;

    let modalTitle = "";
    let modalCustomId = "";

    if (selection === "report-bug") {
        modalTitle = "🐞 Report a Bug";
        modalCustomId = "submit-bug";
    } else if (selection === "report-feature") {
        modalTitle = "💡 Request a Feature";
        modalCustomId = "submit-feature";
    } else {
        return;
    }

    const modal = new ModalBuilder()
        .setCustomId(modalCustomId)
        .setTitle(modalTitle);

    const descriptionInput = new TextInputBuilder()
        .setCustomId("report-description")
        .setLabel("Describe your issue/request:")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

    const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput);
    modal.addComponents(actionRow);

    try {
        await interaction.showModal(modal);
    } catch (error) {
        console.error("❌ Error opening modal:", error);
    }
}

/** ✅ Handle Modal Submission */
export async function handleModalSubmit(interaction: ModalSubmitInteraction<CacheType>) {
    if (!["submit-bug", "submit-feature"].includes(interaction.customId)) return;

    try {
        await interaction.deferReply({ ephemeral: true }).catch(() => {}); // ✅ Prevents timeout

        const reportType = interaction.customId === "submit-bug" ? "Bug" : "Feature";
        const description = interaction.fields.getTextInputValue("report-description");

        await BugReport.create({
            userId: interaction.user.id,
            type: reportType,
            description,
            status: "Open",
        });

        await interaction.editReply({ content: `✅ Your **${reportType.toLowerCase()}** has been submitted!` }).catch(() => {});

        await updateBugTrackerEmbed(interaction.guildId ?? undefined);

    } catch (error) {
        console.error("❌ Error saving bug report:", error);
        await interaction.editReply({ content: "❌ Failed to save your report. Please try again later." }).catch(() => {});
    }
}

/** 🔄 **Update Bug Tracker Embed** */
export async function updateBugTrackerEmbed(guildId?: string) {
    if (!guildId) return;

    try {
        const bugReports = await BugReport.findAll({ where: { type: "Bug" } });
        const featureRequests = await BugReport.findAll({ where: { type: "Feature" } });
        const completedFixes = await BugReport.findAll({ where: { status: "Completed" } });
        const inProgress = await BugReport.findAll({ where: { status: "In Progress" } });

        const embed = new EmbedBuilder()
            .setTitle("📜 Bug & Feature Tracker")
            .setColor("Blue")
            .addFields(
                { name: "🐞 Bugs Reported", value: bugReports.length > 0 ? bugReports.map(b => `• ${b.description}`).join("\n") : "✅ No bugs reported." },
                { name: "💡 Feature Requests", value: featureRequests.length > 0 ? featureRequests.map(f => `• ${f.description}`).join("\n") : "✅ No feature requests." },
                { name: "🔨 Fixes Completed", value: completedFixes.length > 0 ? completedFixes.map(c => `• ${c.description}`).join("\n") : "❌ No fixes completed." },
                { name: "⚙️ In Progress", value: inProgress.length > 0 ? inProgress.map(i => `• ${i.description}`).join("\n") : "🔧 Nothing in progress." }
            );

        const channel = client.channels.cache.get(BUG_TRACKER_CHANNEL_ID) as TextChannel;
        if (!channel) {
            console.error("❌ Bug Tracker channel not found!");
            return;
        }

        let trackerMessage = await channel.messages.fetch({ limit: 1 }).then(msgs => msgs.first()).catch(() => null);

        if (trackerMessage) {
            await trackerMessage.edit({ embeds: [embed] }).catch(() => {});
        } else {
            await channel.send({ embeds: [embed] }).catch(() => {});
        }

    } catch (error) {
        console.error("❌ Error updating bug tracker embed:", error);
    }
}