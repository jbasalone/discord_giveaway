import {
    Message,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    Interaction
} from 'discord.js';
import { GuildSettings } from '../models/GuildSettings';


export async function execute(message: Message) {
    try {
        // Fetch the guild's custom prefix or fallback to "!"
        const guildId = message.guild?.id;
        let prefix = "!";
        try {
            const guildSettings = await GuildSettings.findOne({ where: { guildId } });
            if (guildSettings) prefix = String(guildSettings?.get("prefix") || "!").trim();
        } catch (error) {
            console.error(`[Help] Failed to get prefix for guild ${guildId}:`, error);
        }

        const embed = new EmbedBuilder()
            .setTitle("🤖 Giveaway Bot Help Menu")
            .setDescription([
                `**Welcome!** Use the menu below to explore commands.`,
                `Most commands use the prefix \`${prefix}\`.`,
                "",
                `💡 **First time?** Try \`${prefix} ga startup\` for a step-by-step guide!`,
                "",
                "🔽 **Pick a category below to get started!**"
            ].join("\n"))
            .setColor("Blue")
            .setFooter({ text: "Pro tip: Try a category, or type /ga startup to get a walkthrough!" });

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId("help-menu")
                .setPlaceholder("📜 Choose a command category...")
                .addOptions(
                    { label: "🤔 About the Bot", value: "about" },
                    { label: "🚦 Quick Start", value: "quickstart" },
                    { label: "🎉 Basic Giveaways", value: "basic" },
                    { label: "🛠 Custom & Pro Giveaways", value: "custom" },
                    { label: "📝 Templates", value: "template" },
                    { label: "👑 Miniboss Mode", value: "miniboss" },
                    { label: "⏲ Scheduling", value: "scheduling" },
                    { label: "⚙️ Admin Setup", value: "admin" },
                    { label: "🙋 User Commands", value: "user" },
                    { label: "🚀 Advanced Tips", value: "flags" }
                )
        );

        await message.reply({ embeds: [embed], components: [row] });
    } catch (error) {
        console.error("[Help] Error displaying help:", error);
        return message.reply("❌ Oops! Couldn't show the help menu. Please try again.");
    }
}

/**
 * Handles Select Menu interaction for help categories.
 */
export async function handleHelpSelection(interaction: Interaction) {
    if (!interaction.isStringSelectMenu()) return;

    try {
        const category = interaction.values[0];
        const guildId = interaction.guildId;
        let prefix = "!";
        try {
            const guildSettings = await GuildSettings.findOne({ where: { guildId } });
            if (guildSettings) prefix = String(guildSettings?.get("prefix") || "!").trim();
        } catch (error) {
            console.error(`[Help] Failed to get prefix for guild ${guildId}:`, error);
        }

        // --- Command Content ---
        // All descriptions are friendly, with examples & “try this” lines!
        const helpContent: Record<string, { title: string; fields: { name: string, value: string }[] }> = {
            "about": {
                title: "🤔 What can this bot do?",
                fields: [
                    {
                        name: "🎉 Simple & Custom Giveaways",
                        value: "Start quick giveaways, or make complex ones with custom roles, fields, images, and more."
                    },
                    {
                        name: "📦 Templates",
                        value: "Save your favorite giveaway setups for instant re-use!"
                    },
                    {
                        name: "⏲ Scheduled Giveaways",
                        value: "Let the bot run daily/weekly/monthly events for you—set it and forget it!"
                    },
                    {
                        name: "👑 Miniboss Mode",
                        value: "Run 'miniboss' events for certain roles or special occasions."
                    },
                    {
                        name: "🙋 User & Admin Features",
                        value: "Admins can limit who can start giveaways, set bonus entries, and more. Users can join, check, and customize their notifications."
                    },
                    {
                        name: "🆘 Need a walkthrough?",
                        value: `Run \`${prefix} ga startup\` for a hands-on setup guide.`
                    }
                ]
            },
            "quickstart": {
                title: "🚦 Quick Start",
                fields: [
                    {
                        name: "✨ Start a giveaway instantly",
                        value: [
                            `\`${prefix} ga create "Nitro Drop" 1m 1 --role @GiveawayPings\``,
                            "Starts a 1-minute, 1-winner giveaway and pings @GiveawayPings."
                        ].join("\n")
                    },
                    {
                        name: "💡 Tip: Use quotes for multi-word titles!",
                        value: `\`${prefix} ga create "Big Event" 2m 2\``
                    },
                    {
                        name: "📋 What do the numbers mean?",
                        value: [
                            "- The **first number** is duration (e.g. `1m` = 1 minute, `30s` = 30 seconds, `2h` = 2 hours)",
                            "- The **second number** is number of winners"
                        ].join("\n")
                    },
                    {
                        name: "🆘 Try More:",
                        value: `See more categories below, or type \`${prefix} ga help\` anytime!`
                    }
                ]
            },
            "basic": {
                title: "🎉 Basic Giveaways",
                fields: [
                    {
                        name: "🚀 Start a quick giveaway",
                        value: `\`${prefix} ga create "Prize Name" 30s 1 --role @VIP\``
                    },
                    {
                        name: "✨ You can also...",
                        value: [
                            "- Add a channel mention at the end to run it elsewhere: `... #general`",
                            "- Leave out the title for a generic one: `!ga create 30s 1`"
                        ].join("\n")
                    },
                    {
                        name: "🔄 Reroll Winners",
                        value: `\`${prefix} ga reroll <messageID>\` — Pick new winners instantly.`
                    },
                    {
                        name: "❌ Cancel an active giveaway",
                        value: `\`${prefix} ga cancel <messageID>\``
                    },
                    {
                        name: "🔍 Check a giveaway",
                        value: `\`${prefix} ga check <messageID>\``
                    },
                    {
                        name: "📜 List all ongoing giveaways",
                        value: `\`${prefix} ga listga\``
                    }
                ]
            },
            "custom": {
                title: "🛠 Custom & Pro Giveaways",
                fields: [
                    {
                        name: "🌟 Custom giveaways: fully customizable",
                        value: [
                            `\`${prefix} ga custom "Event Title" 5m 2 --role @VIP --extraentries --field "Requirement: Level 100+" --image http://img.com/pic.jpg\``,
                            "",
                            "You can add:",
                            "- `--role` (mention, name, or ID; multiple allowed)",
                            "- `--extraentries` (enables bonus entry system)",
                            "- `--field \"Key: Value\"` (any extra field in the embed)",
                            "- `--host @User` (set a different host)",
                            "- `--image` or `--thumbnail` (image/thumbnail URL or attachment)"
                        ].join("\n")
                    },
                    {
                        name: "⚡ Pro Example",
                        value: [
                            `\`${prefix} ga custom "VIP Mega Drop" 2h 4 --role @VIP,@Super --field "Prize: Nitro" --field "Special: Top 3 get bonus" --image https://...jpg\``
                        ].join("\n")
                    }
                ]
            },
            "template": {
                title: "📝 Templates",
                fields: [
                    {
                        name: "💾 Save a setup for next time",
                        value: [
                            `\`${prefix} ga save --type custom "Nitro Rush" 10m 2 --role @Giveaway --field "Prize: Discord Nitro"\``,
                            "Give your template a name (here: **Nitro Rush**), then reuse it instantly!"
                        ].join("\n")
                    },
                    {
                        name: "🚀 Start from a template",
                        value: [
                            `\`${prefix} ga starttemplate <templateID>\` — Instantly launches a saved setup.`
                        ].join("\n")
                    },
                    {
                        name: "📜 List your templates",
                        value: `\`${prefix} ga listtemplates --mine\``
                    },
                    {
                        name: "🛠 Edit a template",
                        value: `\`${prefix} ga edit <templateID>\``
                    },
                    {
                        name: "❌ Delete a template",
                        value: `\`${prefix} ga delete <templateID>\``
                    }
                ]
            },
            "miniboss": {
                title: "👑 Miniboss Mode",
                fields: [
                    {
                        name: "⚔️ What is Miniboss?",
                        value: "A special high-stakes giveaway for servers running Epic RPG, with stricter rules and bonus support for elite players."
                    },
                    {
                        name: "🚀 Start a Miniboss giveaway",
                        value: [
                            `\`${prefix} ga miniboss "Boss Battle" 1h --field "Requirement: Level 100" --role @VIP --force\``,
                            "- Use `--force` to bypass minimum participants (if allowed)."
                        ].join("\n")
                    },
                    {
                        name: "⚙️ Set your RPG level & TT",
                        value: `\`${prefix} ga setlevel <level> <ttLevel>\``
                    },
                    {
                        name: "📊 Check your level",
                        value: `\`${prefix} ga mylevel\``
                    }
                ]
            },
            "scheduling": {
                title: "⏲ Scheduling",
                fields: [
                    {
                        name: "🗓 Schedule a giveaway for later",
                        value: [
                            `\`${prefix} ga schedule custom "Friday Night" 1h 2 --time 20:30 --repeat weekly --role @Event\``,
                            "- Schedule from template: `ga schedule template <id> --time 20:00`"
                        ].join("\n")
                    },
                    {
                        name: "📋 List scheduled giveaways",
                        value: `\`${prefix} ga listschedule\``
                    },
                    {
                        name: "❌ Delete a scheduled giveaway",
                        value: `\`${prefix} ga cancelschedule <id>\``
                    }
                ]
            },
            "admin": {
                title: "⚙️ Admin Setup & Tools",
                fields: [
                    {
                        name: "🛡 Limit giveaway creation to roles",
                        value: `\`${prefix} ga setrole --allowed add/remove <role>\``
                    },
                    {
                        name: "📋 Set bonus entries for roles",
                        value: `\`${prefix} ga setextraentry @role 2\` (users with this role get 2 extra chances)`
                    },
                    {
                        name: "🚫 Blacklist a role",
                        value: `\`${prefix} ga setblacklist @role\``
                    },
                    {
                        name: "🔗 Restrict giveaways to channels",
                        value: `\`${prefix} ga setchannel add #channel\``
                    },
                    {
                        name: "📋 View settings",
                        value: `\`${prefix} ga showconfig\``
                    }
                ]
            },
            "user": {
                title: "🙋 User Commands",
                fields: [
                    {
                        name: "🔢 Set your level/TT",
                        value: `\`${prefix} ga setlevel <level> <ttLevel>\``
                    },
                    {
                        name: "📊 Check your info",
                        value: `\`${prefix} ga mylevel\``
                    },
                    {
                        name: "📜 List ongoing giveaways",
                        value: `\`${prefix} ga listga\``
                    }
                ]
            },
            "flags": {
                title: "🚀 Advanced Tips & Examples",
                fields: [
                    {
                        name: "🏷 Add extra fields (requirements, notes, links...)",
                        value: [
                            `\`--field "Requirement: Level 100+"\``,
                            `\`--field "Prize: Nitro"\``
                        ].join("\n")
                    },
                    {
                        name: "📢 Ping multiple roles",
                        value: `\`--role @VIP @Winners AnotherRole\` or \`--role @VIP,@Winners\` (space or comma separated)`
                    },
                    {
                        name: "🎨 Add an image or thumbnail",
                        value: [
                            "`--image <url or upload>`",
                            "`--thumbnail <url or upload>`"
                        ].join("\n")
                    },
                    {
                        name: "💾 Save a custom setup",
                        value: [
                            `\`${prefix} ga save --type custom "Nitro Drop" 10m 2 --role @Event --field "Prize: Nitro"\``
                        ].join("\n")
                    },
                    {
                        name: "📋 Pro tip: Mix & match options!",
                        value: [
                            `\`${prefix} ga custom "Legendary" 1h 3 --role @Winners --extraentries --host @Admin --field "Note: This is epic!" --image http://pic.com/abc.jpg\``
                        ].join("\n")
                    }
                ]
            }
        };

        const { title, fields } = helpContent[category] || helpContent["about"];

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(`*Commands use prefix \`${prefix}\`. Need help? Use \`${prefix} ga startup\` for a guided tour!*`)
            .setColor("Blue")
            .addFields(fields);

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId("help-menu")
                .setPlaceholder("📜 Choose another category...")
                .addOptions(
                    { label: "🤔 About the Bot", value: "about" },
                    { label: "🚦 Quick Start", value: "quickstart" },
                    { label: "🎉 Basic Giveaways", value: "basic" },
                    { label: "🛠 Custom & Pro Giveaways", value: "custom" },
                    { label: "📝 Templates", value: "template" },
                    { label: "👑 Miniboss Mode", value: "miniboss" },
                    { label: "⏲ Scheduling", value: "scheduling" },
                    { label: "⚙️ Admin Setup", value: "admin" },
                    { label: "🙋 User Commands", value: "user" },
                    { label: "🚀 Advanced Tips", value: "flags" }
                )
        );

        await interaction.update({
            embeds: [embed],
            components: [row]
        });

    } catch (error) {
        console.error("[Help] Error handling menu selection:", error);
        await interaction.reply({ content: "❌ An error occurred while showing help. Try again.", ephemeral: true });
    }
}