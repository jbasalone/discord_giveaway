import { Giveaway } from '../models/Giveaway';
import { sequelize, closeDB } from '../database';

beforeEach(async () => {
    await sequelize.sync({ force: true });

    try {
        await Giveaway.create({
            title: "Test Giveaway",
            host: "test_host",
            channelId: "test_channel",
            messageId: "test_message",
            duration: 60000,
            endsAt: new Date(Date.now() + 60000),
            winnerCount: 1,
            participants: JSON.stringify([]),
        });
    } catch (error) {
        console.warn("⚠️ Duplicate giveaway detected, skipping insertion.");
    }
});

test('❌ Should prevent duplicate giveaways', async () => {
    await Giveaway.create({
        host: "test_host",
        channelId: "test_channel",
        messageId: "test_message",
        title: "Test Giveaway",
        description: "React to enter!",
        duration: 600000,
        endsAt: Math.floor(Date.now() / 1000) + 600,
        participants: JSON.stringify(["user1", "user2"]),
        winnerCount: 2,
        extraFields: JSON.stringify([])
    });

    await expect(
        Giveaway.create({
            host: "test_host",
            channelId: "test_channel",
            messageId: "test_message",
            title: "Test Giveaway",
            description: "React to enter!",
            duration: 600000,
            endsAt: Math.floor(Date.now() / 1000) + 600,
            participants: JSON.stringify(["user1", "user2"]),
            winnerCount: 2,
            extraFields: JSON.stringify([])
        })
    ).rejects.toThrow("Validation error");
});

afterEach(async () => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    await sequelize.close(); // ✅ Ensures DB connections close properly
});
