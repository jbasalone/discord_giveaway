import { Message, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, Interaction } from 'discord.js';
import { GuildSettings } from '../models/GuildSettings';

export async function execute(message: Message) {
    try {
        // 🛠️ Fetch the guild's custom prefix or fallback to "!"
        const guildId = message.guild?.id;
        let prefix = "!"; // Default

        try {
            const guildSettings = await GuildSettings.findOne({ where: { guildId } });

            if (guildSettings) {
                prefix = String(guildSettings?.get("prefix") || "!").trim();
            } else {
                console.warn(`⚠️ [WARNING] No GuildSettings found for guild ${guildId}, using default prefix.`);
            }
        } catch (error) {
            console.error(`❌ [ERROR] Failed to retrieve prefix for guild ${guildId}:`, error);
        }

        console.log(`📌 [DEBUG] Retrieved Prefix for Guild (${guildId}):`, prefix); // Debug to check retrieved prefix

        const embed = new EmbedBuilder()
            .setTitle(`Giveaway Bot Help Menu`)
            .setDescription(`Use the menu below to explore command categories. Commands are prefixed with \`${prefix}\`. 
            \n🚀New to GA Bot? use \`${prefix} ga startup\` for a quick guide`)
            .setColor("Blue");

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId("help-menu")
                .setPlaceholder("📜 Select a command category...")
                .addOptions(
                    { label: "📢 About the Bot", value: "about" },
                    { label: "🎉 Basic Commands", value: "basic" },
                    { label: "📜 Template Commands", value: "template" },
                    { label: "⏲ Scheduling Commands", value: "scheduling" },
                    { label: "⚙️ Admin Commands", value: "admin" },
                    { label: "👑 Miniboss Commands", value: "miniboss" },
                    { label: "🕵️ Secret Giveaway", value: "secret" },
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
        const guildId = interaction.guildId;
          let prefix = "!"; // Default

        try {
                const guildSettings = await GuildSettings.findOne({ where: { guildId } });
                if (guildSettings) {
                    prefix = String(guildSettings?.get("prefix") || "!").trim();
                } else {
                    console.warn(`⚠️ [WARNING] No GuildSettings found for guild ${guildId}, using default prefix.`);
                }
            } catch (error) {
                console.error(`❌ [ERROR] Failed to retrieve prefix for guild ${guildId}:`, error);
            }

        // Replace "!ga" dynamically with the correct prefix
        const commands: Record<string, { name: string; value: string }[]> = {
            "about": [
                { name: "🎉 What does this bot do?", value: `This bot allows servers to host giveaways with advanced customization, template saving for quick starts, automated prize drawing, and role-based restrictions.` },
                { name: "🔹 Types of Giveaways", value: `- **Quick Giveaways**: Basic \`${prefix} ga create\` giveaways.\n- **Custom Giveaways**: Advanced giveaways with roles & extra entries.\n- **Miniboss Giveaways**: High-stakes giveaways with specific requirements.` },
                { name: "🕵 Secret Giveaways", value: `Secret Giveaways randomly send join messages to random channels, and the first number of winners to join win.` },
                { name: "🔑 User vs Admin", value: `- **Users**: Join giveaways, check status, set their levels.\n- **Admins**: Configure giveaway settings, set role permissions, restrict channels, etc.` },
                { name: "🚀 Custom Structure Example", value: `\`${prefix} ga custom Mythic GA 1h 3 --role tt25--extraentries --field "Requirement: Level 100+"\`` },
                { name: "🚀 Basic Structure Example", value: `\`${prefix} ga create Mythic GA 1h 3 --role tt25\`` },
                { name: "🚀 Miniboss Structure Example", value: `\`${prefix} ga mb Mythic GA 1h --field "whatevertitle: whatever message" --role VIP\`` },
                { name: "📜 Author", value: `Bot created by <@!936693149114449921>. If you are interested in using the bot, please contact the author.` },
                { name: "🤲 Help Keep the Bot Running!", value: `The bot is **100% free**, and donations are **never required**. If you’d like to support server costs, visit: [Ko-fi](https://ko-fi.com/jenny_b)` },
            ],
            "basic": [
                { name: "🚀 Basic Structure Example", value: `\`${prefix} ga create Mythic GA 20s 3 --role tt25 #channel\`` },
                { name: "🚀 Basic Structure Example - Generic Title", value: `\`${prefix} ga create 1h 3 --role VIP\`` },
                { name: "🚀 Custom Structure Example", value: `\`${prefix} ga custom Mythic GA 1h 3 --role tt25 --extraentries --field "Requirement: Level 100+"\`` },
                { name: "Optional Flags: `[--host]`", value: `Sets a host for the giveaway, defaults to you.` },
                { name: "Optional Flags: `[--field \"name: value\"]`", value: `Sets custom embed fields (e.g., \`req: Level 50+\`).` },
                { name: "Optional Flags: `[--role \"rolename\"]`", value: `Pings a role when the giveaway starts.` },
                { name: "Optional Flags: `[--extraentries]`", value: `Gives Users Extra Entries based on server config.` },
                { name: "Optional Flags: `[--winners]`", value: `Add pre-selected winners (custom and miniboss only).` },
                { name: "🎉 Start a Quick Giveaway", value: `\`${prefix} ga create  <duration> <winners> --role <rolename>\`\nExample: \`${prefix} ga create Super GA 30s 1\`` },
                { name: "🛠 Start a Custom Giveaway", value: `\`${prefix} ga custom <title> <duration> <winners> [--extraentries]\`\nExample: \`${prefix} ga custom Mythic Giveaway 1h 3\`` },
                { name: "🔄 Reroll Winners", value: `\`${prefix} ga reroll <messageID>\`` },
                { name: "❌ Delete an Active Giveaway", value: `\`${prefix} ga delete <messageID>\`` },
                { name: "🔍 Check Giveaway Status", value: `\`${prefix} ga check <messageID> | all\`` },
                { name: "📜 View Ongoing Giveaways", value: `\`${prefix} ga listga\`` },
            ],
            "template": [
                { name: "💾 Save a Giveaway Template", value: `\`${prefix} ga save --type <custom|miniboss> <name> <duration> [winners]\`` },
                { name: "🚀 Start a Giveaway from a Saved Template", value: `\`${prefix} ga starttemplate <ID>\`` },
                { name: "📜 List All Saved Giveaway Templates", value: `\`${prefix} ga listtemplates --all\`` },
                { name: "📜 List Your Saved Giveaway Templates", value: `\`${prefix} ga listtemplates --mine\`` },
                { name: "🛠 Edit Your Template", value: `\`${prefix} ga edit 2 --role @GiveawayPings --field "Reward: Nitro"\`` },
                { name: "❌ Delete a Saved Template", value: `\`${prefix} ga delete <ID>\`` },
                { name: "Optional Flags: `[--host]`", value: "- Sets a host for the giveaway, defaults to you." },
                { name: "Optional Flags: `[--field \"name: value\"]`", value: "- Sets custom embed fields (e.g., `req: Level 50+`)." },
                { name: "Optional Flags: `[--role \"rolename\"]`", value: "- Pings a role when the giveaway starts." },
                { name: "Optional Flags: `[--extraentries]`", value: "- Gives Users Extra Entries based on server config." },
                { name: "Optional Flags: `[--force]`", value: "- Allows **Miniboss giveaways** to start with fewer participants." },
                { name: "Optional Flags: `[--mine/all]`", value: "- lists only your templates or all templates." },

            ],
            "admin": [
                { name: "⚙️ Show Server Giveaway Settings", value: `\`${prefix} ga showconfig\`` },
                { name: "➕ Add Bonus Entries for a Role", value: `\`${prefix} ga setextraentry @role <entries>\`` },
                { name: "🚫 Blacklist a Role", value: `\`${prefix} ga setblacklist @role\`` },
                { name: "📌 Restrict Giveaways to Specific Channels", value: `\`${prefix} ga setchannel add #channel\`` },
                { name: "📜 List Configured Roles", value: `\`${prefix} ga listroles\`` },
                { name: "👑 Restrict GA Creation to Specific Roles", value: `\`${prefix} ga setrole --allowed add/remove <roleid>\`` },
                { name: "👑 Role Pings and Role Mapping", value: `\`${prefix} ga setrole --role add/remove rolename: <roleid>\`` },
                { name: "👑 Set Miniboss Host Role", value: `\`${prefix} ga setrole --miniboss add/remove @role\`` },
                { name: "⚙️ List Configured Miniboss Host Roles", value: `\`${prefix} ga listmbroles\``},
                { name: "👑 Set Miniboss Channel", value: `\`${prefix} ga mbch #channel\`` },
                { name: "🚫 Cancel a GA", value: `\`${prefix} ga cancel messasgeid\`` },

            ],
            "secret": [
                { name: "🕵 About Secret Giveaway", value: `Secret giveaways send random messages to random channels asking users to join. The first number of winners to join wins.` },
                { name: "🚀 Start a Secret Giveaway", value: `\`${prefix} ga secret 10 48 "Hidden giveaway message!"\`` },
                { name: "🔄 Turn Secret Giveaway On/Off", value: `\`${prefix} ga setsecret on|off\`` },
                { name: "⚙️ Configure Secret Giveaway Categories", value: `\`${prefix} ga setsecret on|off <channelid> <channelid>\`` },
                { name: "📌 Set Summary Channel", value: `\`${prefix} ga setsummary #channel\`` },
            ],
            "miniboss": [
                { name: "🚀 Start a Miniboss Giveaway", value: `\`${prefix} ga miniboss <title> <duration> [--force]\`\n- **--force** allows starting with fewer than 9 participants.` },
                { name: "⚔️ Alias for Miniboss Giveaway", value: `\`${prefix} ga mb <title> <duration>\`` },
                { name: "Optional Flags: `[--host]`", value: `Sets a host for the giveaway, defaults to you.` },
                { name: "Optional Flags: `[--field \"name: value\"]`", value: `Sets custom embed fields (e.g., \`req: Level 50+\`).` },
                { name: "Optional Flags: `[--role \"rolename\"]`", value: `Pings a role when the giveaway starts.` },
                { name: "Optional Flags: `[--force]`", value: `Allows **Miniboss giveaways** to start with fewer participants.` },
                { name: "Optional Flags: `[--winners]`", value: `Add pre-selected winners for Miniboss giveaways.` },
            ],
            "scheduling": [
                { name: "🚀 Start a Scheduled Giveaway", value: `\`${prefix} ga schedule custom <title> <duration> <winnercount> -time 18:00 --repeat hourly\`` },
                { name: "🚀 Start a Scheduled Giveaway From Templates", value: `\`${prefix} ga schedule template <templateid> -time 18:00 --repeat hourly\`` },
                { name: "📜 List Schedules", value: `\`${prefix} ga listschedule\`` },
                { name: "📜 Delete a Schedule", value: `\`${prefix} ga cancelschedule <id>\`` },
                { name: "Flags: `[--time]`", value: `ex. --time 20:30, --time 2025-03-05 18:00 → (March 5, 2025, at 6:00 PM server time), --time 30s, --time 2d, --time 2m, --time 1740808623 (exact UTC format) ` },
                { name: "Flags: `[--repeat]`", value: `ex. --repeat hourly | daily | weekly | monthly `},

            ],
            "user": [
                { name: "🔢 Set Your RPG Level & TT Level", value: `\`${prefix} ga setlevel <level> <ttLevel>\`` },
                { name: "📊 Check Your Level Settings", value: `\`${prefix} ga mylevel\`` },
                { name: "📜 View Ongoing Giveaways", value: `\`${prefix} ga listga\`` },
            ],
            "flags": [
                { name: "Optional Flags: `[--host]`", value: `Sets a host for the giveaway, defaults to you.` },
                { name: "Optional Flags: `[--field \"name: value\"]`", value: `Sets custom embed fields (e.g., \`req: Level 50+\`).` },
                { name: "Optional Flags: `[--role \"rolename\"]`", value: `Pings a role when the giveaway starts.` },
                { name: "Optional Flags: `[--extraentries]`", value: `Gives Users Extra Entries based on server config.` },
                { name: "Optional Flags: `[--force]`", value: `Allows Miniboss giveaways to start with fewer participants.` },
                { name: "Optional Flags: `[--winners]`", value: `Add pre-selected winners for Miniboss only.` },
            ]
        };

        const selectedCommands = commands[category];

        const embed = new EmbedBuilder()
            .setTitle(`📜 ${category.charAt(0).toUpperCase() + category.slice(1)} Commands`)
            .setDescription(`Here are the commands for this category (Prefix: \`${prefix}\`).`)
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
                    { label:  "⏲ Scheduling Commands", value: "scheduling"},
                    { label: "🚀 Advanced Flags & Examples", value: "flags" },
                    { label: "🕵️ Secret Giveaway", value: "secret" },
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