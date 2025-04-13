import { Client, GatewayIntentBits } from "discord.js";
import { ScheduledGiveaway } from "./models/ScheduledGiveaway";
import { checkScheduledGiveaways } from "./utils/checkScheduledGiveaways"; // ✅ Import Fixed
import { startTemplateGiveaway } from "./commands/startTemplate"; // ✅ Import Fixed
import { startCustomGiveaway } from "./commands/customGiveaway"; // ✅ Import Fixed
import { Op } from "sequelize"; // ✅ Import Fixed

async function testScheduleSystem(client: Client) {
    console.log("🔍 [TEST] Running Schedule System Test...");

    // ✅ Ensure database is connected
    await ScheduledGiveaway.sync();
    console.log("✅ Database connected successfully.");

    const now = new Date();
    const tenMinutesLater = new Date(now.getTime() + 10 * 60 * 1000); // 10 min after

    // ✅ Insert a mock scheduled giveaway
    const mockGuildId = "123456789012345678";
    const mockChannelId = "987654321098765432";
    const mockHostId = "555555555555555555";

    const scheduledGiveaway = await ScheduledGiveaway.create({
        guildId: mockGuildId,
        channelId: mockChannelId,
        title: "Mock Giveaway",
        type: "template",
        templateId: 1,
        duration: 60000,
        winnerCount: 1,
        extraFields: JSON.stringify({ "Requirement": "Level 50+" }),
        scheduleTime: now,
        repeatInterval: "none",
        repeatDay: null,
        repeatTime: null,
        repeatCount: null,
        host: mockHostId,
        args: JSON.stringify(["template", "1"]),
        role: null,
        reminderSent: 0,
    });

    console.log(`✅ [TEST] Scheduled Giveaway Added: ID ${scheduledGiveaway.id}`);

    // ✅ Run checkScheduledGiveaways function to process it
    await checkScheduledGiveaways(client);

    // ✅ Verify if the giveaway was removed after execution
    const remainingGiveaway = await ScheduledGiveaway.findOne({ where: { id: scheduledGiveaway.id } });

    if (remainingGiveaway) {
        console.error("❌ [TEST] Scheduled Giveaway was NOT removed!");
    } else {
        console.log("✅ [TEST] Scheduled Giveaway was removed after execution.");
    }

    console.log("✅ All tables synchronized.");
}

// ✅ Create a Discord client instance for testing
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.once("ready", async () => {
    console.log(`✅ Bot is online! Logged in as ${client.user?.tag}`);
    await testScheduleSystem(client);
});

client.login("MTIzNDczMTc5Njk0NDY1MDM0MA.GaY6Gq.xheGqEaW-Rv3mmlbs_XiAg07tD0yVbDzTbSjN8"); // ✅ Ensure you use a valid bot token