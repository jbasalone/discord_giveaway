import {
    Message,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ModalSubmitInteraction,
    Interaction,
    TextChannel,
    APIEmbed,
    ButtonInteraction
} from 'discord.js';
import { SavedGiveaway } from '../models/SavedGiveaway';
import { QueryTypes} from "sequelize";
import { sequelize } from "../database";

const pendingEdits = new Map<string, Record<string, string | number>>();
const templateMessageMap = new Map<string, string>();

/** Generate Embed for Editing */
async function generateEditEmbed(templateId: number | string): Promise<APIEmbed | null> {
    const numericTemplateId = parseInt(templateId as string, 10); // ✅ Ensure numeric type
    console.log(`🔍 [DEBUG] Generating embed for template: ${numericTemplateId} (Type: ${typeof numericTemplateId})`);

    // 🔥 Step 1: Check If ID Exists in Raw SQL Query
    const checkQuery = await sequelize.query(`SELECT id FROM saved_giveaways WHERE id = :id`, {
        replacements: { id: numericTemplateId },
        type: QueryTypes.SELECT
    });
    console.log(`📋 [DEBUG] Raw SQL Query Result:`, checkQuery);

    // 🔥 Step 2: Check All Available IDs in Database
    const allIds = await SavedGiveaway.findAll({ attributes: ["id"], raw: true });
    console.log(`📋 [DEBUG] Full List of IDs in Database:`, allIds.map(row => row.id));

    // 🔥 Step 3: Run `findOne()` and Check Result
    let savedTemplate = await SavedGiveaway.findOne({
        where: { id: numericTemplateId },  // ✅ Ensure correct numeric comparison
        raw: true // ✅ Force raw data for direct retrieval
    });

    if (!savedTemplate) {
        console.error(`❌ [ERROR] Template ${numericTemplateId} not found in the database.`);
        return null;
    }

    console.log(`📋 [DEBUG] Found Template Data:`, savedTemplate); // ✅ Confirm data retrieval

    let templateEdits = pendingEdits.get(String(numericTemplateId)) || {}; // 🔥 Ensure key consistency
    console.log(`📋 [DEBUG] Pending Edits (To Merge):`, templateEdits);

    // ✅ Apply pending edits correctly (Fix applied here)
    const mergedTemplate = { ...savedTemplate, ...templateEdits };

    try {
        let savedExtraFields = JSON.parse(savedTemplate.extraFields || "{}");
        let newExtraFields = templateEdits["extraFields"] ? JSON.parse(String(templateEdits["extraFields"])) : {};
        mergedTemplate.extraFields = JSON.stringify({ ...savedExtraFields, ...newExtraFields });
    } catch (error) {
        console.error("❌ [ERROR] Failed to merge extraFields JSON:", error);
    }

    console.log(`🔍 [DEBUG] Final Merged Template:`, mergedTemplate);

    const fields: { name: string; value: string }[] = [];
    const fieldsToExclude = new Set(["id", "guildId", "type", "creator"]);
    const seenFields = new Set<string>();

    function addField(name: string, value: any) {
        if (!seenFields.has(name) && !fieldsToExclude.has(name)) {
            fields.push({ name, value: String(value) });
            seenFields.add(name);
        }
    }

    // ✅ Add main fields
    Object.entries(mergedTemplate).forEach(([key, value]) => {
        if (key !== "extraFields") addField(key, String(value));
    });

    // ✅ Add extra fields separately
    try {
        const extraFields = JSON.parse(mergedTemplate.extraFields || "{}");
        Object.entries(extraFields).forEach(([key, value]) => {
            addField(key, value);
        });
    } catch (error) {
        console.error("❌ [ERROR] Failed to parse extraFields JSON:", error);
    }

    return {
        title: `📝 Editing Template: ${mergedTemplate.title}`,
        description: `📌 Select a section to edit below:`,
        color: 0x3498db,
        fields: fields.length > 0 ? fields : [{ name: "No fields available", value: "No data found." }]
    };
}

async function updateEditMessage(channel: TextChannel, templateId: number | string) {
    const numericTemplateId = Number(templateId);
    console.log(`🔄 [DEBUG] Updating edit message for template: ${numericTemplateId} (Type: ${typeof numericTemplateId})`);

    const embed = await generateEditEmbed(String(numericTemplateId)); // ✅ Convert to string
    console.log(`🔄 [DEBUG] Updating Edit Message with Fresh Embed:`, embed);

    if (!embed) {
        console.error(`❌ [ERROR] Failed to generate embed for template: ${numericTemplateId}`);
        return;
    }

    const selectMenuOptions = embed.fields
        ? embed.fields.map(field => ({
            label: field.name.substring(0, 25),
            value: encodeURIComponent(field.name),
            description: String(field.value).substring(0, 50),
        }))
        : [];

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`edit-template-${numericTemplateId}`)
        .setPlaceholder("📝 Select a section to edit")
        .addOptions(selectMenuOptions);

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`preview-${numericTemplateId}`)
            .setLabel("🔍 Preview")
            .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
            .setCustomId(`save-${numericTemplateId}`)
            .setLabel("💾 Save")
            .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
            .setCustomId(`exit-${numericTemplateId}`)
            .setLabel("🚪 Exit ")
            .setStyle(ButtonStyle.Danger)
    );

    try {
        let message;
        if (templateMessageMap.has(String(numericTemplateId))) { // 🔥 Ensure key consistency
            const messageId = templateMessageMap.get(String(numericTemplateId));
            message = await channel.messages.fetch(messageId!).catch(() => null);
        }

        if (message) {
            await message.edit({
                embeds: [embed],
                components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu), buttons],
            });
        } else {
            const sentMessage = await channel.send({
                content: "📝 **Editing Giveaway Template**",
                embeds: [embed],
                components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu), buttons],
            });
            templateMessageMap.set(String(numericTemplateId), sentMessage.id); // ✅ Ensure ID is stored as string
        }
    } catch (error) {
        console.error(`❌ [ERROR] Failed to update edit message:`, error);
    }
}
/** Handle Save & Exit */
export async function handleButton(interaction: ButtonInteraction) {
    try {
        const [action, templateIdRaw] = interaction.customId.split("-").slice(-2);
        const templateId = Number(templateIdRaw);

        if (isNaN(templateId)) {
            console.error("❌ [ERROR] Invalid template ID received:", templateIdRaw);
            return interaction.reply({ content: "❌ Invalid template ID.", ephemeral: true });
        }

        console.log(`🔍 [DEBUG] Button Clicked: ${action} (Template ID: ${templateId}, Type: ${typeof templateId})`);

        const savedTemplate = await SavedGiveaway.findOne({ where: { id: templateId } });

        if (!savedTemplate) {
            console.error("❌ [ERROR] Template not found in DB.");
            return interaction.reply({ content: "❌ Template not found.", ephemeral: true });
        }

        if (interaction.user.id !== savedTemplate.get("creator")) {
            return await interaction.reply({ content: "❌ You are not authorized to edit this template.", ephemeral: true });
        }

        // ✅ Retrieve pending edits
        const templateEdits = pendingEdits.get(String(templateId)) || {};
        console.log(`💾 [DEBUG] Pending Edits:`, templateEdits);

        if (action === "preview") {
            console.log(`🔍 [DEBUG] Generating Preview with Latest Pending Edits:`, templateEdits);

            const mergedTemplate = { ...savedTemplate.dataValues, ...templateEdits };

            const extraFields = JSON.parse(mergedTemplate.extraFields || "{}");

            const embed = new EmbedBuilder()
                .setTitle(` **${mergedTemplate.title}**`)
                .setDescription(`**Host:** <@${mergedTemplate.host}>\n**Server:** ${interaction.guild?.name}`)
                .setColor("Blue")
                .addFields([
                    { name: "🎟️ Total Participants", value: "0 users", inline: true },
                    { name: "⏳ Ends In", value: `${Math.floor(mergedTemplate.duration / 1000)} seconds`, inline: true }, // ✅ Convert ms → s
                    { name: "🏆 Winners", value: `${mergedTemplate.winnerCount}`, inline: true },
                    ...Object.entries(extraFields).map(([key, value]) => ({
                        name: key,
                        value: String(value), // ✅ FIX: Convert unknown to string safely
                        inline: true
                    }))
                ])
                .setTimestamp();

            try {
                await interaction.deferReply();
                return interaction.followUp({ content: "📢 **Preview of the Giveaway:**", embeds: [embed] });
            } catch (error) {
                console.error("⚠️ [WARNING] Interaction already acknowledged, sending follow-up.", error);
                return interaction.followUp({ content: "📢 **Preview of the Giveaway:**", embeds: [embed] });
            }
        }

        else if (action === "save" || action === "save-exit") {
            if (Object.keys(templateEdits).length === 0) {
                return interaction.reply({ content: "❌ No changes detected. Nothing to save.", ephemeral: true });
            }

            let updateData: Record<string, any> = {};
            let savedExtraFields = JSON.parse(savedTemplate.get("extraFields") || "{}");
            let newExtraFields: Record<string, any> = {};

            Object.keys(templateEdits).forEach(key => {
                if (key in savedTemplate.dataValues) {
                    updateData[key] = templateEdits[key];
                } else {
                    newExtraFields[key] = templateEdits[key];
                }
            });

            if (Object.keys(newExtraFields).length > 0) {
                updateData["extraFields"] = JSON.stringify({ ...savedExtraFields, ...newExtraFields });
            }

            console.log(`📝 [DEBUG] Final Update Payload:`, updateData);

            try {
                const updateResult = await SavedGiveaway.update(updateData, { where: { id: templateId } });

                if (updateResult[0] === 0) {
                    console.error("❌ [ERROR] Update failed, no rows affected.");
                    return interaction.reply({ content: "❌ Failed to update the template. No changes detected.", ephemeral: true });
                }

                pendingEdits.delete(String(templateId));

                console.log(`✅ [SUCCESS] Template ID ${templateId} saved successfully!`);

                if (action === "save-exit") {
                    let message = await interaction.channel?.messages.fetch(interaction.message.id);
                    if (message) {
                        await message.delete();
                    }
                    return interaction.reply({ content: "✅ Template saved & exited edit mode!", ephemeral: true });
                } else {
                    return interaction.reply({ content: "✅ Template saved successfully!", ephemeral: true });
                }
            } catch (dbError) {
                console.error("❌ [ERROR] Failed to save template to database:", dbError);
                return interaction.reply({ content: "❌ Failed to save template. Check logs.", ephemeral: true });
            }
        }

        else if (action === "exit") {
            console.log(`🚪 [DEBUG] Exiting without saving edits for Template ID: ${templateId}`);
            pendingEdits.delete(String(templateId));

            try {
                let message = await interaction.channel?.messages.fetch(interaction.message.id);
                if (message) {
                    await message.delete();
                }
            } catch (error) {
                console.error(`❌ [ERROR] Failed to delete edit message:`, error);
            }

            return interaction.reply({ content: "🚪 GA Bot Out.", ephemeral: true });
        }

    } catch (error) {
        console.error("❌ [ERROR] Failed to process button interaction:", error);
        await interaction.reply({ content: "❌ An error occurred.", ephemeral: true });
    }
}

/** Handle Edit Selection */
export async function handleSelectMenu(interaction: StringSelectMenuInteraction) {
    const templateId = interaction.customId.replace("edit-template-", "");
    let fieldId = decodeURIComponent(interaction.values[0]);

    console.log(`🔍 [DEBUG] Selected Field for Editing: ${fieldId}`);

    const modal = new ModalBuilder()
        .setCustomId(`edit-template-modal-${templateId}-${encodeURIComponent(fieldId)}`)
        .setTitle(`Edit: ${fieldId}`)
        .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId("new_value")
                    .setLabel(`New Value for ${fieldId}`)
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
            )
        );

    await interaction.showModal(modal);
}

/** Handle Modal Submission */
export async function handleModal(interaction: ModalSubmitInteraction) {
    try {
        const [templateId, fieldId] = interaction.customId.replace("edit-template-modal-", "").split("-").map(decodeURIComponent);
        const newValue = interaction.fields.getTextInputValue("new_value").trim();

        console.log(`🔄 [DEBUG] Updating Field: ${fieldId}, New Value: ${newValue}`);

        if (!pendingEdits.has(templateId)) {
            pendingEdits.set(templateId, {});
        }

        // Fetch existing template to modify `extraFields`
        const savedTemplate = await SavedGiveaway.findOne({ where: { id: templateId } });

        if (!savedTemplate) {
            return interaction.reply({ content: "❌ Template not found.", ephemeral: true });
        }

        // ✅ Fix: Explicitly define extraFields as a flexible object
        let existingExtraFields: Record<string, any> = {};

        try {
            existingExtraFields = JSON.parse(savedTemplate.get("extraFields") || "{}");
        } catch (error) {
            console.error("❌ [ERROR] Failed to parse extraFields JSON:", error);
        }

// ✅ Now TypeScript allows indexing safely
        existingExtraFields[fieldId] = newValue;

        // ✅ Store the update in `pendingEdits`
        pendingEdits.get(templateId)!.extraFields = JSON.stringify(existingExtraFields);

        console.log(`📋 [DEBUG] Updated Pending Edits:`, pendingEdits);

        // ✅ Update the UI
        if (interaction.channel instanceof TextChannel) {
            await updateEditMessage(interaction.channel, templateId);
        }

        await interaction.deferUpdate();
    } catch (error) {
        console.error("❌ [ERROR] Failed to handle modal:", error);
        if (!interaction.replied) {
            await interaction.reply({ content: "❌ An error occurred while processing your edit.", ephemeral: true });
        }
    }
}

export async function execute(message: Message, args: string[]) {
    if (!args.length) {
        return message.reply("❌ Please provide a valid template ID.");
    }

    const templateId = parseInt(args[0], 10); // ✅ Convert input safely
    if (isNaN(templateId)) {
        return message.reply("❌ Invalid template ID.");
    }

    console.log(`🔍 [DEBUG] Fetching template with ID: ${templateId} (Type: ${typeof templateId})`);

    // ✅ Direct raw SQL query for debugging
    const [results] = await sequelize.query(
        `SELECT id, CAST(guildId AS CHAR) as guildId, name, title, description, duration, winnerCount,
                extraFields, type, forceStart, CAST(host AS CHAR) as host, CAST(role AS CHAR) as role,
                CAST(creator AS CHAR) as creator
         FROM saved_giveaways WHERE id = :id LIMIT 1`,
        {
            replacements: { id: templateId },
            type: QueryTypes.SELECT
        }
    ) as unknown as any[];

    console.log(`📋 [DEBUG] Raw SQL Query Results:`, results);

    if (!results) {
        console.error(`❌ [ERROR] Raw SQL: Template ID ${templateId} not found in database.`);
        return message.reply("❌ Template not found.");
    }

    if (message.channel instanceof TextChannel) {
        console.log(`📝 [DEBUG] Executing edit command for Template ID: ${templateId}`);
        await updateEditMessage(message.channel, templateId);
    } else {
        return message.reply("❌ This command must be used in a server text channel.");
    }
}

/** Handle Interaction */
export async function handleInteraction(interaction: Interaction) {
    if (interaction.isButton()) {
        await handleButton(interaction as ButtonInteraction);
    } else if (interaction.isStringSelectMenu()) {
        await handleSelectMenu(interaction as StringSelectMenuInteraction);
    } else if (interaction.isModalSubmit()) {
        await handleModal(interaction as ModalSubmitInteraction);
    }
}