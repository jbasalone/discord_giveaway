import { EmbedBuilder, Message, TextChannel, NewsChannel, ThreadChannel } from 'discord.js';
import {GuildSettings} from "../models/GuildSettings";

export async function execute(message: Message) {
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
    const embed = new EmbedBuilder()
        .setTitle("🎉 Giveaway System — Startup Guide")
        .setDescription("Welcome to the GA system. This guide will show you how to quickly start giveaways, set up reusable templates, and run miniboss events.")
        .setColor(0x5865F2)
        .addFields(
            {
                name: "🛡️ 1. Admin Setup (Once per server)",
                value:
                    `**Set Default Role (pinged in giveaways):**\n\`${prefix} ga settings defaultRole @GiveawayRole\`\n` +
                    `**Allow Roles to Start Giveaways:**\n\`${prefix} ga roles add @GiveawayManager\`\n` +
                    `**Approve a Channel (run inside the channel):**\n\`${prefix} ga channels add\`\n` +
                    `**Set Miniboss Channel (optional):**\n\`${prefix} ga settings minibossChannel #miniboss-fights\``
            },
            {
                name: "🚀 2. Start a Basic Giveaway",
                value:
                    "**\"I want a fast giveaway with no extras\"**\n" +
                    `\`${prefix} ga start "Nitro Drop" 30m 1\`\n` +
                    "*30m = duration · 1 = winner count*"
            },
            {
                name: "⚙️ 3. Custom Giveaways (Advanced)",
                value:
                    "**\"I want entry requirements, images, or extra fields\"**\n" +
                    `\`${prefix} ga custom "VIP Pack" 1h 2 --field "Requirement: Must be Level 5+" --role VIP\`\n` +
                    "**Options:**\n" +
                    "`--field \"Label: Value\"` · `--host @User` · `--role VIP`\n" +
                    "`--extraentries` · `--image` · `--thumbnail` (use w/ attachment or URL)"
            },
            {
                name: "💾 4. Saved Templates",
                value:
                    "**\"I want to save a giveaway to reuse later\"**\n" +
                    `\`${prefix} ga save --type custom "Nitro Pack" 30m --field "Prize: Nitro" --role VIP\`\n` +
                    "**Then start anytime with:**\n" +
                    `\`${prefix} ga start 1\``
            },
            {
                name: "🧙 5. Miniboss Giveaways (Epic RPG Style)",
                value:
                    "**\"I want to run an RPG-style miniboss battle\"**\n" +
                    `\`${prefix} ga miniboss "Miniboss Battle" 30m 9\`\n` +
                    "- Grants access to private miniboss channel\n" +
                    "- Bot posts RPG commands (desktop & mobile)\n" +
                    "- Host controls rerolls, timeouts, end manually\n" +
                    "- Auto-cleanup if idle for 20 mins"
            },
            {
                name: "💡 Sample Command",
                value:
                    `\`${prefix} ga custom "Treasure Chest" 1h 3 --field "Level Req: 20+" --extraentries --thumbnail https://example.com/pic.png\``
            },
            {
                name: "🆘 Help & Commands",
                value: `Use \`${prefix} ga help\` for a full command list and syntax.`
            }
        )
        .setFooter({ text: `Prefix: ${prefix} • Type "${prefix} ga help" for more` });

    if (
        message.channel &&
        'send' in message.channel &&
        typeof message.channel.send === 'function'
    ) {
        await message.channel.send({ embeds: [embed] });
    }
}