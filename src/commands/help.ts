import { Message, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, Interaction } from 'discord.js';

export async function execute(message: Message) {
    try {
        // ✅ Initial embed with category selection
        const embed = new EmbedBuilder()
            .setTitle("📜 Giveaway Bot Help Menu")
            .setDescription("Select a category below to view specific commands.")
            .setColor("Blue");

        // ✅ Dropdown for selecting categories
        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId("help-menu")
                .setPlaceholder("📜 Select a command category...")
                .addOptions(
                    new StringSelectMenuOptionBuilder().setLabel("🎉 Basic Commands").setValue("basic"),
                    new StringSelectMenuOptionBuilder().setLabel("📜 Template Commands").setValue("template"),
                    new StringSelectMenuOptionBuilder().setLabel("⚙️ Admin Commands").setValue("admin"),
                    new StringSelectMenuOptionBuilder().setLabel("👑 Miniboss Commands").setValue("miniboss") // ✅ New Miniboss Category
                )
        );

        // ✅ Send the intro message first
        await message.reply({ embeds: [embed], components: [row] });

    } catch (error) {
        console.error("❌ Error displaying help:", error);
        return message.reply("❌ An error occurred while displaying help.");
    }
}

// ✅ Handling interaction from dropdown selection
export async function handleHelpSelection(interaction: Interaction) {
    if (!interaction.isStringSelectMenu()) return;

    try {
        const category = interaction.values[0];

        // ✅ Updated command list with all features
        const commands: Record<string, { name: string; value: string }[]> = {
            "basic": [
                { name: "`!ga create <duration> <winners>`", value: "🎉 Starts a new giveaway. Example: `!ga create 30s 1`" },
                { name: "`!ga custom <title> <duration> <winners> --field \"name: description\"`", value: "🛠 Starts a custom giveaway with named fields. Example: `!ga custom \"Gold Giveaway\" 1m 1 --field \"Requirement: Level 50+\"`" },
                { name: "`!ga reroll <giveawayID>`", value: "🔄 **Rerolls winners** for a completed giveaway." },
                { name: "`!ga setchannel <#channel>`", value: "📢 Sets a custom giveaway channel. Example: `!ga setchannel #giveaways`" }
            ],
            "template": [
                { name: "`!ga save <name>`", value: "💾 Saves the current giveaway setup as a template." },
                { name: "`!ga starttemplate <name>`", value: "🚀 Starts a giveaway from a saved template." },
                { name: "`!ga listtemplates`", value: "📜 Lists all saved giveaway templates." },
                { name: "`!ga deletetemplate <name>`", value: "❌ Deletes a saved giveaway template." },
            ],
            "admin": [
                { name: "`!ga setprefix <prefix>`", value: "⚙️ Sets a custom prefix for the server." },
                { name: "`!ga showconfig`", value: "📋 Displays the current giveaway settings for the server." },
                { name: "`!ga setextraentry @role <entries>`", value: "📌 Assigns extra giveaway entries to a role. Example: `!ga setextraentry @VIP 3`" },
                { name: "`!ga setminibosschannel <#channel>`", value: "👑 Sets the Miniboss Event channel for automatic management." } // ✅ New Miniboss Channel Config
            ],
            "miniboss": [
                { name: "`!ga miniboss <title> <duration> --force --field \"name: description\"`", value: "👑 Starts a Miniboss Giveaway. Use `--force` to ensure all users win if under 9 participants." },
                { name: "`!ga mb <title> <duration> --force --field \"name: description\"`", value: "⚔️ Short alias for `!ga miniboss`." },
                { name: "`!ga setminibosschannel <#channel>`", value: "🏆 Sets a custom miniboss event channel." }
            ]
        };

        // ✅ Ensure category is a valid key
        if (!(category in commands)) {
            await interaction.reply({ content: "❌ Invalid selection.", ephemeral: true });
            return;
        }

        const selectedCommands = commands[category];

        const embed = new EmbedBuilder()
            .setTitle(`📜 ${category.charAt(0).toUpperCase() + category.slice(1)} Commands`)
            .setDescription("Here are the commands for this category:")
            .setColor("Blue")
            .addFields(selectedCommands.map((cmd) => ({ name: cmd.name, value: cmd.value }))); // ✅ Properly type `cmd`

        // ✅ Keep the menu selector after updating the message
        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId("help-menu")
                .setPlaceholder("📜 Select a command category...")
                .addOptions(
                    new StringSelectMenuOptionBuilder().setLabel("🎉 Basic Commands").setValue("basic"),
                    new StringSelectMenuOptionBuilder().setLabel("📜 Template Commands").setValue("template"),
                    new StringSelectMenuOptionBuilder().setLabel("⚙️ Admin Commands").setValue("admin"),
                    new StringSelectMenuOptionBuilder().setLabel("👑 Miniboss Commands").setValue("miniboss") // ✅ New Miniboss Category
                )
        );

        await interaction.update({
            embeds: [embed],
            components: [row], // ✅ Keeps the selector visible
        });

    } catch (error) {
        console.error("❌ Error handling help selection:", error);
        await interaction.reply({ content: "❌ An error occurred while processing your selection.", ephemeral: true });
    }
}