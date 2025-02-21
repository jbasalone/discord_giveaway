import { Message, PermissionsBitField } from 'discord.js';
import { GuildSettings } from '../models/GuildSettings';
import { MinibossRoles } from '../models/MinibossRoles';

export async function execute(message: Message, args: string[]) {
  if (!message.guild) {
    return message.reply("❌ This command must be used inside a server.");
  }

  if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.reply("❌ You need `Administrator` permissions to set roles.");
  }

  const guildId = message.guild?.id ?? "";

  const subCommand = args.shift()?.toLowerCase();

  if (!subCommand || !["--allowed", "--role", "--miniboss"].includes(subCommand)) {
    return message.reply("❌ Invalid usage! Example:\n" +
        "`!ga setrole --allowed add/remove GiveawayManager MinibossMaster`\n" +
        "`!ga setrole --role add/remove GiveawayPings: @Winners`\n" +
        "`!ga setrole --miniboss add/remove @role`");
  }

  let guildSettings = await GuildSettings.findOne({ where: { guildId } });

  if (!guildSettings) {
    guildSettings = await GuildSettings.create({ guildId });
  }

  if (subCommand === "--allowed") {
    const action = args.shift()?.toLowerCase() ?? "";
    if (!["add", "remove"].includes(action)) {
      return message.reply("❌ Usage: `!ga setrole --allowed add/remove <role>`.");
    }

    let existingRoles: string[] = [];
    try {
      existingRoles = JSON.parse(guildSettings.get("allowedRoles") ?? "[]");
    } catch {
      existingRoles = [];
    }

    if (action === "add") {
      const newRoles = args.map(role => role.trim()).filter(role => !existingRoles.includes(role));
      existingRoles.push(...newRoles);

      console.log("📌 Allowed Roles Being Saved:", existingRoles);
      await guildSettings.update({ allowedRoles: JSON.stringify(existingRoles) });

      return message.reply(`✅ Allowed roles for giveaways updated:\n**${existingRoles.join(", ")}**`);
    }

    if (action === "remove") {
      const roleToRemove = args[0]?.trim();
      if (!roleToRemove) return message.reply("❌ Please specify a role to remove.");

      existingRoles = existingRoles.filter(role => role !== roleToRemove);

      console.log("📌 Allowed Roles After Removal:", existingRoles);
      await guildSettings.update({ allowedRoles: JSON.stringify(existingRoles) });

      return message.reply(`✅ Removed **${roleToRemove}** from allowed roles.`);
    }
  }

  if (subCommand === "--role") {
    const action = args.shift()?.toLowerCase() ?? "";
    if (!["add", "remove"].includes(action)) {
      return message.reply("❌ Usage: `!ga setrole --role add/remove RoleName: @RoleMention`.");
    }

    let roleMappings: Record<string, string> = {};
    try {
      roleMappings = JSON.parse(guildSettings.get("roleMappings") ?? "{}");
    } catch {
      roleMappings = {};
    }

    if (action === "add") {
      const rolePairs = args.join(" ").match(/(\S+):\s*(<@&\d+>|\d+)/g);
      if (!rolePairs) {
        return message.reply("❌ No valid role mappings detected. Use format: `RoleName: @RoleMention` or `RoleName: RoleID`.");
      }

      for (const rolePair of rolePairs) {
        const [roleName, roleValue] = rolePair.split(":").map(str => str.trim());
        const roleId = roleValue.match(/<@&(\d+)>/)?.[1] || roleValue;
        if (roleName && roleId) roleMappings[roleName] = roleId;
      }

      console.log("📌 Role Mappings Being Saved:", roleMappings);
      await guildSettings.update({ roleMappings: JSON.stringify(roleMappings) });

      return message.reply(`✅ Giveaway role mappings updated:\n${JSON.stringify(roleMappings, null, 2)}`);
    }

    if (action === "remove") {
      const roleNameToRemove = args[0]?.trim();
      if (!roleNameToRemove || !roleMappings[roleNameToRemove]) {
        return message.reply("❌ Invalid role. Ensure the role exists in mappings.");
      }

      delete roleMappings[roleNameToRemove];

      console.log("📌 Role Mappings After Removal:", roleMappings);
      await guildSettings.update({ roleMappings: JSON.stringify(roleMappings) });

      return message.reply(`✅ Removed **${roleNameToRemove}** from role mappings.`);
    }
  }

  if (subCommand === "--miniboss") {
    const action = args.shift()?.toLowerCase() ?? "";

    if (!["add", "remove"].includes(action)) {
      return message.reply("❌ Usage: `!ga setrole --miniboss add/remove @role`.");
    }

    const role = message.mentions.roles.first();
    if (!role) {
      return message.reply("❌ Please **mention a valid role**.");
    }

    if (action === "add") {
      await MinibossRoles.create({ guildId, roleId: role.id });
      return message.reply(`✅ **${role.name}** can now start Miniboss Giveaways.`);
    }

    if (action === "remove") {
      await MinibossRoles.destroy({ where: { guildId, roleId: role.id } });
      return message.reply(`✅ **${role.name}** can **no longer** start Miniboss Giveaways.`);
    }
  }
}