import { Message, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, Interaction } from 'discord.js';

export async function execute(message: Message) {
    try {
        const embed = new EmbedBuilder()
            .setTitle("📜 Giveaway Bot Help Menu")
            .setDescription("Use the menu below to explore command categories.")
            .setColor("Blue");

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId("help-menu")
                .setPlaceholder("📜 Select a command category...")
                .addOptions(
                    { label: "📢 About the Bot", value: "about" },
                    { label: "🎉 Basic Commands", value: "basic" },
                    { label: "📜 Template Commands", value: "template" },
                    { label: "⚙️ Admin Commands", value: "admin" },
                    { label: "👑 Miniboss Commands", value: "miniboss" },
                    { label: "🛡️ User Commands", value: "user" },
                    { label: "🚀 Advanced Flags & Examples", value: "flags" }
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
            "about": [
                { name: "🎉 **What does this bot do?**", value: "- This bot allows servers to host giveaways with advanced customization, template saving for quick starts, automated prize drawing, and role-based restrictions." },
                { name: "🔹 **Types of Giveaways**", value: "- **Quick Giveaways**: Basic `!ga create` giveaways.\n- **Custom Giveaways**: Advanced giveaways with roles & extra entries.\n- **Miniboss Giveaways**: High-stakes giveaways with specific requirements." },
                { name: "🔑 **User vs Admin**", value: "- **Users**: Join giveaways, check status, set their levels.\n- **Admins**: Configure giveaway settings, set role permissions, restrict channels, etc." },
                { name: "🚀 Custom Structure Example", value: "`!ga custom Mythic GA 1h 3 --role VIP --extraentries --field \"Requirement: Level 100+\"`" },
                { name: "🚀 Basic Structure Example", value: "- `!ga create Mythic GA 1h 3 --role VIP`" },
                { name: "🚀 Miniboss Structure Example", value: "- `!ga mb Mythic GA 1h --field \"whatevertitle: whatever message\" --role VIP`" },
                { name: "📜 **Author**", value: "- Bot created by <@!936693149114449921>. If you are interested in using the bot, please contact the author"},
                { name: "🤲 **Help Keep the Bot Running!**",     value: "- The bot is **100% free**, and donations are **never required**. If you’d like to support server costs, visit: [Ko-fi](https://ko-fi.com/jenny_b)]"},


            ],
            "basic": [
                { name: "🚀 Basic Structure Example", value: "- `!ga create Mythic GA 1h 3 --role VIP`" },
                { name: "🚀 Custom Structure Example", value: "- `!ga custom Mythic GA 1h 3 --role VIP --extraentries --field \"Requirement: Level 100+\"`" },
                { name: "Optional Flags: `[--host]`", value: "- Sets a host for the giveaway, defaults to you." },
                { name: "Optional Flags: `[--field \"name: value\"]`", value: "- Sets custom embed fields (e.g., `req: Level 50+`)." },
                { name: "Optional Flags: `[--role \"rolename\"]`", value: "- Pings a role when the giveaway starts." },
                { name: "Optional Flags: `[--extraentries]`", value: "- Gives Users Extra Entries based on server config." },
                { name: "Optional Flags: `[--winners]`", value: "- add pre-selected winners (custom and mb only)" },
                { name: "`!ga create <title> <duration> <winners>`", value: "🎉 Starts a quick giveaway. Example: `!ga create Super GA 30s 1`" },
                { name: "`!ga custom <title> <duration> <winners> [--extraentries]`", value: "🛠 Starts a **custom giveaway**. Example: `!ga custom Mythic Giveaway 1h 3`." },
                { name: "`!ga reroll <messageID>`", value: "🔄 **Rerolls winners** for a completed giveaway." },
                { name: "`!ga delete <messageID>`", value: "❌ **Deletes an active giveaway.**" },
                { name: "`!ga check <messageID> | all`", value: "🔍 **Checks the status** of a specific giveaway." },
            ],
            "template": [
                { name: "Optional Flags: `[--host]`", value: "- Sets a host for the giveaway, defaults to you." },
                { name: "Optional Flags: `[--field \"name: value\"]`", value: "- Sets custom embed fields (e.g., `req: Level 50+`)." },
                { name: "Optional Flags: `[--role \"rolename\"]`", value: "- Pings a role when the giveaway starts." },
                { name: "Optional Flags: `[--extraentries]`", value: "- Gives Users Extra Entries based on server config." },
                { name: "Optional Flags: `[--force]`", value: "- Allows **Miniboss giveaways** to start with fewer participants." },
                { name: "`!ga save --type <custom|miniboss> <name> <duration> [winners]`", value: "💾 Saves a **giveaway template**." },
                { name: "`!ga starttemplate <ID>`", value: "🚀 Starts a **giveaway from a saved template**." },
                { name: "`!ga listtemplates`", value: "📜 Lists all **saved giveaway templates**." },
                { name: "`!ga deletetemplate <ID>`", value: "❌ Deletes a saved template **by ID**." }
            ],
            "admin": [
                { name: "`!ga showconfig`", value: "⚙️ **Displays server giveaway settings**." },
                { name: "`!ga setextraentry @role <entries>`", value: "➕ **Adds bonus entries** for a role." },
                { name: "`!ga setblacklist @role`", value: "🚫 **Blacklists a role from joining giveaways**." },
                { name: "`!ga setchannel add #channel`", value: "📌 **Restricts giveaways to specific channels**." },
                { name: "`!ga listroles`", value: "📜 Lists all **configured roles**." },
                { name: "`!ga setrole --allowed  add/remove <roleid>`", value: "👑 **Restricts GA creation to specific roles**." },
                { name: "`!ga setrole --role add/remove rolename: <roleid>`", value: "👑 **Role Pings** and name to use with --role." },
                { name: "`!ga setrole --miniboss add/remove @role`", value: "👑 set **Miniboss Host** to allow miniboss gas ." },
                { name: "`!ga mbch #channel`", value: "👑 **Miniboss Channel** for executing MB." },

            ],
            "miniboss": [
                { name: "Optional Flags: `[--host]`", value: "- Sets a host for the giveaway, defaults to you." },
                { name: "Optional Flags: `[--field \"name: value\"]`", value: "- Sets custom embed fields (e.g., `req: Level 50+`)." },
                { name: "Optional Flags: `[--role \"rolename\"]`", value: "- Pings a role when the giveaway starts." },
                { name: "Optional Flags: `[--force]`", value: "- Allows **Miniboss giveaways** to start with fewer participants." },
                { name: "Optional Flags: `[--winners]`", value: "- add pre-selected winners ." },
                { name: "🚀 Miniboss Structure Example", value: "- `!ga mb Mythic GA 1h --field \"whatevertitle: whatever message\" --role VIP`" },
                { name: "`!ga miniboss <title> <duration> [--force]`", value: "🐲 **Starts a Miniboss Giveaway**. \n --force allows starting with less than 9 participants." },
                { name: "`!ga mb <title> <duration>`", value: "⚔️ **Alias for Miniboss Giveaway**." }
            ],
            "user": [
                { name: "`!ga setlevel <level> <ttLevel>`", value: "🔢 **Set your RPG level & TT level for Miniboss giveaways**." },
                { name: "`!ga mylevel`", value: "📊 **Check your current level settings**." },
                { name: "`!ga listgiveaways`", value: "📜 **View ongoing giveaways you can join**." }
            ],
            "flags": [
                { name: "Optional Flags: `[--host]`", value: "- Sets a host for the giveaway, defaults to you." },
                { name: "Optional Flags: `[--field \"name: value\"]`", value: "- Sets custom embed fields (e.g., `req: Level 50+`)." },
                { name: "Optional Flags: `[--role \"rolename\"]`", value: "- Pings a role when the giveaway starts." },
                { name: "Optional Flags: `[--extraentries]`", value: "- Gives Users Extra Entries based on server config." },
                { name: "Optional Flags: `[--force]`", value: "- Allows **Miniboss giveaways** to start with fewer participants." },
                { name: "Optional Flags: `[--winners]`", value: "- add pre-selected winners ." },

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

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId("help-menu")
                .setPlaceholder("📜 Select another category...")
                .addOptions(
                    { label: "📢 About the Bot", value: "about" },
                    { label: "🎉 Basic Commands", value: "basic" },
                    { label: "📜 Template Commands", value: "template" },
                    { label: "👑 Miniboss Commands", value: "miniboss" },
                    { label: "🚀 Advanced Flags & Examples", value: "flags" },
                    { label: "🛡️ User Commands", value: "user" },
                    { label: "⚙️ Admin Commands", value: "admin" }
                )
        );

        await interaction.update({
            embeds: [embed],
            components: [row],
        });

    } catch (error) {
        console.error("❌ Error handling help selection:", error);
        await interaction.reply({ content: "❌ An error occurred while processing your selection.", ephemeral: true });
    }
}