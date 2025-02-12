import { executeJoinLeave } from '../events/giveawayJoin';
import { Giveaway } from '../models/Giveaway';
import { sequelize } from '../database';

beforeAll(async () => {
  console.log("🔄 Ensuring database is connected...");
  await sequelize.authenticate();
  await sequelize.sync({ force: true });
});

beforeEach(async () => {
  console.log("♻️ Resetting database before test...");
  await Giveaway.destroy({ where: {} });

  // ✅ Provide ALL required fields
  await Giveaway.create({
    id: 1,                    // ✅ Ensures test data exists
    title: "Test Giveaway",
    host: "test_host",
    channelId: "test_channel",
    messageId: "123456789",
    duration: 3600,
    endsAt: Math.floor(Date.now() / 1000) + 3600, // ✅ UNIX timestamp for test consistency
    winnerCount: 1
  });

  await sequelize.sync();
});

test("✅ Should allow user to join", async () => {
  const giveaway = await Giveaway.findOne({ where: { id: 1 } });
  expect(giveaway).toBeDefined();

  const interaction = {
    customId: "join-1",
    user: { id: "test_user" },
    reply: jest.fn(),
  } as any;

  await executeJoinLeave(interaction);

  expect(interaction.reply).toHaveBeenCalledWith({
    content: expect.stringMatching(/joined.*giveaway/i),
    ephemeral: true
  });
});

afterAll(async () => {
  console.log("🛑 Closing database connection...");
  await sequelize.close();
});