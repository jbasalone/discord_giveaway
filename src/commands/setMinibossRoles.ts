import { Message, PermissionsBitField } from "discord.js";
import { GuildSettings } from "../models/GuildSettings";

/**
 * Command: `!setttroles <tt01_role_id> <tt1-25_role_id> <tt25_role_id>`
 * Example: `!setttroles 123456789012345678 987654321098765432 567890123456789012`
 */
export async function execute(message: Message, args: string[]) {
    if (!message.guild) return message.reply("❌ This command must be used inside a server.");

    // ✅ **Check Admin Permissions**
    if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply("❌ You must be an **Administrator** to set TT level roles.");
    }

    if (args.length !== 3) {
        return message.reply("❌ Invalid format! Use: `!setttroles <tt01_role_id> <tt1-25_role_id> <tt25_role_id>`");
    }

    const [tt01, tt1_25, tt25] = args;

    // ✅ **Validate Role IDs**
    const invalidRoles = args.filter(roleId => !message.guild?.roles.cache.has(roleId));
    if (invalidRoles.length > 0) {
        return message.reply(`❌ Invalid Role IDs: ${invalidRoles.join(", ")}`);
    }

    const guildId = message.guild.id;

    // ✅ **Save to `guild_settings`**
    try {
        const existingSettings = await GuildSettings.findOne({ where: { guildId } });

        if (existingSettings) {
            await GuildSettings.update(
                { ttLevelRoles: JSON.stringify({ TT01: tt01, "TT1-25": tt1_25, TT25: tt25 }) },
                { where: { guildId } }
            );
        } else {
            await GuildSettings.create({
                guildId,
                ttLevelRoles: JSON.stringify({ TT01: tt01, "TT1-25": tt1_25, TT25: tt25 }),
            });
        }

        console.log(`✅ [DEBUG] TT Roles Updated: TT01=${tt01}, TT1-25=${tt1_25}, TT25=${tt25}`);
        return message.reply(`✅ **TT Level Roles Updated Successfully!**\n📌 TT01: <@&${tt01}>\n📌 TT1-25: <@&${tt1_25}>\n📌 TT25: <@&${tt25}>`);
    } catch (error) {
        console.error("❌ Error saving TT roles:", error);
        return message.reply("❌ Failed to save TT Level roles. Check logs for details.");
    }
}

export { execute as setTTRoles };