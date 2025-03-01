import { Message } from "discord.js";
import { ScheduledGiveaway } from "../models/ScheduledGiveaway";

export async function execute(message: Message, args: string[]) {
    if (!message.guild) return message.reply("❌ This command must be used inside a server.");
    if (args.length < 1) return message.reply("❌ Specify a scheduled giveaway ID.");

    const id = parseInt(args[0], 10);
    if (isNaN(id)) return message.reply("❌ Invalid ID.");

    const giveaway = await ScheduledGiveaway.findByPk(id, { attributes: ["id", "guildId"] });

    if (!giveaway) return message.reply(`❌ No scheduled giveaway found with ID **${id}**.`);

    // ✅ Always use `get("guildId")`
    console.log(`🔍 Checking Guild ID: Scheduled [${giveaway.get("guildId")}] vs. Message [${message.guild.id}]`);

    if (String(giveaway.get("guildId")) !== String(message.guild.id)) {
        return message.reply("❌ You can only cancel giveaways in your server.");
    }

    await giveaway.destroy();
    return message.reply(`✅ Scheduled giveaway **${id}** has been cancelled.`);
}