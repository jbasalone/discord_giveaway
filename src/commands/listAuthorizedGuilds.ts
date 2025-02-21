import { Message } from 'discord.js';
import { BotAccess } from '../models/BotAccess';
import { client } from '../index'; // Ensure this points to your bot instance

export async function execute(message: Message) {
    try {
        const authorizedGuilds = await BotAccess.findAll();

        if (!authorizedGuilds || authorizedGuilds.length === 0) {
            return message.reply("❌ No authorized guilds found.");
        }

        // ✅ Retrieve guild names from Discord
        const guildEntries = await Promise.all(
            authorizedGuilds.map(async (entry) => {
                const guildId = entry.get("guildId");

                try {
                    const guild = await client.guilds.fetch(guildId);
                    return `• **${guild.name}** (${guildId})`;
                } catch (error) {
                    console.warn(`⚠️ Could not fetch guild name for ID ${guildId}:`, error);
                    return `• **Unknown Guild** (${guildId})`;
                }
            })
        );

        return message.reply(`✅ **Authorized Guilds:**\n${guildEntries.join("\n")}`);
    } catch (error) {
        console.error("❌ Error fetching authorized guilds:", error);
        return message.reply("❌ Failed to retrieve authorized guilds.");
    }
}