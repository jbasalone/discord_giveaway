import { Message } from 'discord.js';
import { SavedGiveaway } from '../models/SavedGiveaway';
import { convertToMilliseconds } from '../utils/convertTime';

export async function execute(message: Message, args: string[]) {
    try {
        // ✅ Check permissions
        if (!message.member?.permissions.has("ManageGuild")) {
            return message.reply("❌ You need **Manage Server** permissions to save a giveaway template.");
        }

        // ✅ Extract template name
        const templateName = args.shift();
        if (!templateName) return message.reply("❌ Please provide a template name.");

        // ✅ Extract giveaway details
        const title = args.shift() || '🎉 Custom Giveaway 🎉';
        const durationArg = args.find(arg => arg.match(/\d+[smhd]/)) || '1m';
        const winnerCount = parseInt(args.find(arg => !isNaN(Number(arg))) || '1');
        const duration = convertToMilliseconds(durationArg);
        const role = message.mentions.roles.first()?.id || null;

        if (duration <= 0) return message.reply("❌ Invalid duration!");
        if (isNaN(winnerCount) || winnerCount < 1) return message.reply("❌ Invalid winner count!");

        // ✅ Extract Extra Fields (custom requirements)
        const extraFields: { name: string; value: string }[] = [];
        const fieldRegex = /--field\s"(.+?)"/g;
        let match;
        while ((match = fieldRegex.exec(message.content)) !== null) {
            extraFields.push({ name: '📌 Info', value: match[1] });
        }

        // ✅ Determine if it's a Miniboss or Standard Giveaway
        const isMiniboss = title.toLowerCase().includes("miniboss");

        // ✅ Save or update the template
        await SavedGiveaway.upsert({
            guildId: message.guild!.id,
            hostId: message.author.id, // ✅ Ensure `hostId` is always provided
            name: templateName,
            title,
            description: "React to enter!", // ✅ Ensure description exists
            duration,
            winnerCount,
            roleId: role,
            extraFields: JSON.stringify(extraFields)
        });

        // ✅ Confirmation message
        message.reply(`✅ Giveaway template **${templateName}** saved! Use \`!ga starttemplate ${templateName}\` to start it.`);

    } catch (error) {
        console.error("❌ Error saving giveaway template:", error);
        message.reply("❌ An error occurred while saving the template.");
    }
}
