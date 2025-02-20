import { Message, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, Interaction } from 'discord.js';

export async function execute(message: Message) {
    try {
        const embed = new EmbedBuilder()
            .setTitle("📜 Giveaway Bot Help Menu")
            .setDescription("Select a category below to view specific commands.")
            .setColor("Blue");

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId("help-menu")
                .setPlaceholder("📜 Select a command category...")
                .addOptions(
                    { label: "🎉 Basic Commands", value: "basic" },
                    { label: "📜 Template Commands", value: "template" },
                    { label: "⚙️ Admin Commands", value: "admin" },
                    { label: "👑 Miniboss Commands", value: "miniboss" }
                )
        );

        await message.reply({ embeds: [embed], components: [row] });

    } catch (error) {
        console.error("❌ Error displaying help:", error);
        return message.reply("❌ An error occurred while displaying help.");
    }
}

export async function handleHelpSelection(interaction: Interaction) {
    if (!interaction.isStringSelectMenu()) return;

    try {
        const category = interaction.values[0];

        const commands: Record<string, { name: string; value: string }[]> = {
            "basic": [
                { name: "Optional Flags: `[--host]`", value: "Sets a host for the giveaway, defaults to you." },
                { name: "Optional Flags:`[--field \"name: value\"]`", value: "Sets the embed fields, e.g., `req: none`. Can have multiple." },
                { name: "Optional Flags: `[--role \"rolename\"]`", value: "Pings a role when the giveaway starts." },
                { name: "Optional Flags: `[--extraentries`", value: "Gives Users Extra Entries based on server config." },
                { name: "`!ga create <title> <duration> <winners>`", value: "🎉 Starts a quick giveaway. Example: `!ga create Super GA 30s 1`" },
                { name: "`!ga custom <title> <duration> <winners> [--extraentries]`", value: "🛠 Starts a **custom giveaway**. Example: `!ga custom Mythic Giveaway 1h 3`." },
                { name: "`!ga reroll <messsageID>`", value: "🔄 **Rerolls winners** for a completed giveaway." },
                { name: "`!ga delete <messsageID>`", value: "❌ **Deletes an active giveaway.**" },
                { name: "`!ga check <messsageID> | all`", value: "🔍 **Checks the status** of a specific giveaway." },
            ],
            "template": [
                { name: "Optional Flags: `[--host]`", value: "Sets a host for the giveaway, defaults to you." },
                { name: "Optional Flags:`[--field \"name: value\"]`", value: "Sets custom embed fields." },
                { name: "Optional Flags: `[--role \"rolename]`", value: "Pings a role when the giveaway starts." },
                { name: "Optional Flags: `[--extraentries`", value: "Gives Users Extra Entries based on server config." },
                { name: "`!ga save --type <custom|miniboss> <name> <duration> [winners] --role`", value: "💾 Saves a **giveaway template**." },
                { name: "`!ga starttemplate <ID>`", value: "🚀 Starts a **giveaway from a saved template**." },
                { name: "`!ga listtemplates`", value: "📜 Lists all **saved giveaway templates**." },
                { name: "`!ga deletetemplate <ID>`", value: "❌ Deletes a saved template **by ID**." },
                { name: "`!ga edit <ID> --title \"New Title\"`", value: "✏️ Edits the **title** of a saved template." },
                { name: "`!ga edit <ID> --duration 5m`", value: "⏳ Updates the **duration** of a template." },
                { name: "`!ga edit <ID> --winners 3`", value: "🏆 Changes the **number of winners**." },
                { name: "`!ga edit <ID> --type miniboss`", value: "👑 Converts a template to a **Miniboss Giveaway**." },
                { name: "`!ga edit <ID> --force`", value: "🔥 Enables **Force Start Mode** (Miniboss Only)." },
                { name: "`!ga edit <ID> --field \"Requirement: Level 100+\"`", value: "📋 **Modifies giveaway fields**." }
            ],
            "admin": [
                { name: "`!ga showconfig`", value: "⚙️ **Displays server giveaway settings**." },
                { name: "`!ga setprefix <prefix>`", value: "⚙️ Sets a **custom bot prefix** for the server. Default is `!`." },
                { name: "`!ga setextraentry @role <entries>`", value: "➕ **Adds bonus entries** for a role." },
                { name: "`!ga setminibosschannel <#channel>`", value: "🏆 **Sets the Miniboss Giveaway channel**." },
                { name: "`!ga setrole --allowed <roleid>`", value: "🔐 **Sets the roles allowed to run giveaways**." },
                { name: "`!ga setrole --role <name> <roleid>`", value: "📌 **Sets the pingable roles for giveaways**." },
                { name: "`!ga listroles`", value: "📜 Lists all **configured roles**." }
            ],
            "miniboss": [
                { name: "Optional Flags: `[--force]`", value: "Allows the giveaway to end with fewer than **9 participants**." },
                { name: "Optional Flags: `[--field \"name: value\"]`", value: "Sets custom embed fields." },
                { name: "Optional Flags: `[--role \"rolename]`", value: "Uses the role name to ping when GA starts." },
                { name: "`!ga miniboss <title> <duration> [--force] [--field \"name: value\"]`", value: "🐲 **Starts a Miniboss Giveaway**." },
                { name: "`!ga mb <title> <duration> --role`", value: "⚔️ **Alias for Miniboss Giveaway**." },
                { name: "`!ga setminibosschannel <#channel>`", value: "🏆 **Sets the Miniboss Giveaway channel**." }
            ]
        };

        if (!(category in commands)) {
            await interaction.reply({ content: "❌ Invalid selection.", ephemeral: true });
            return;
        }

        const selectedCommands = commands[category];

        const embed = new EmbedBuilder()
            .setTitle(`📜 ${category.charAt(0).toUpperCase() + category.slice(1)} Commands`)
            .setDescription("Here are the commands for this category:")
            .setColor("Blue")
            .addFields(selectedCommands.map((cmd) => ({ name: cmd.name, value: cmd.value })));

        await interaction.update({ embeds: [embed] });

    } catch (error) {
        console.error("❌ Error handling help selection:", error);
        await interaction.reply({ content: "❌ An error occurred while processing your selection.", ephemeral: true });
    }
}