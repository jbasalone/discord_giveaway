import { Message, PermissionsBitField } from 'discord.js';
import { GuildSettings } from '../models/GuildSettings';

export async function execute(message: Message, args: string[]) {
  if (!message.guild) {
    return message.reply("❌ This command must be used inside a server.");
  }

  if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.reply("❌ You need `Administrator` permissions to set roles.");
  }

  const guildId = message.guild.id;
  const subCommand = args.shift()?.toLowerCase();

  if (!subCommand || (subCommand !== "--allowed" && subCommand !== "--role")) {
    return message.reply("❌ Invalid usage! Example:\n" +
        "`!ga setrole --allowed GiveawayManager MinibossMaster`\n" +
        "`!ga setrole --role GiveawayPings: @Winners`");
  }

  let guildSettings = await GuildSettings.findOne({ where: { guildId } });

  if (!guildSettings) {
    guildSettings = await GuildSettings.create({ guildId });
  }

  if (subCommand === "--allowed") {
    // ✅ Parse Existing Allowed Roles
    let existingRoles: string[] = [];
    try {
      existingRoles = JSON.parse(guildSettings.get("allowedRoles") ?? "[]");
    } catch {
      existingRoles = [];
    }

    // ✅ Append New Roles Without Duplicates
    const newRoles = args.map(role => role.trim()).filter(role => !existingRoles.includes(role));
    existingRoles.push(...newRoles);

    console.log("📌 Allowed Roles Being Saved:", existingRoles);

    await guildSettings.update({ allowedRoles: JSON.stringify(existingRoles) });

    return message.reply(`✅ Allowed roles for giveaways updated:\n**${existingRoles.join(", ")}**`);
  }

  if (subCommand === "--role") {
    // ✅ Retrieve Existing Role Mappings
    let roleMappings: Record<string, string> = {};
    try {
      roleMappings = JSON.parse(guildSettings.get("roleMappings") ?? "{}");
    } catch {
      roleMappings = {};
    }

    // ✅ Extract Role Pairs Properly (Supports Role Mentions & Role IDs)
    const rolePairs = args.join(" ").match(/(\S+):\s*(<@&\d+>|\d+)/g);

    if (!rolePairs) {
      return message.reply("❌ No valid role mappings detected. Please use format: `RoleName: @RoleMention` or `RoleName: RoleID`.");
    }

    for (const rolePair of rolePairs) {
      const [roleName, roleValue] = rolePair.split(":").map(str => str.trim());

      // ✅ Extract Role ID if it's a mention (`<@&1234567890>`) or use raw ID
      const roleId = roleValue.match(/<@&(\d+)>/)?.[1] || roleValue;

      if (roleName && roleId) {
        roleMappings[roleName] = roleId;
      }
    }

    console.log("📌 Role Mappings Being Saved:", roleMappings);

    // ✅ Ensure it is not an empty object
    if (Object.keys(roleMappings).length === 0) {
      return message.reply("❌ No valid role mappings detected. Please check your format!");
    }

    await guildSettings.update({ roleMappings: JSON.stringify(roleMappings) });

    return message.reply(`✅ Giveaway role mappings updated:\n${JSON.stringify(roleMappings, null, 2)}`);
  }
}