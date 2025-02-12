import { runTest } from '../testGiveaway';
import { sequelize } from '../database';
import {Giveaway} from "../models/Giveaway";

describe('Full Giveaway Integration Test', () => {
  test('Runs Full Giveaway Process', async () => {
    await runTest();
  });
});

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

test('✅ Full Giveaway System Test', async () => {
  await expect(runTest()).resolves.not.toThrow();
});

afterEach(async () => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  await sequelize.close(); // ✅ Ensures DB connections close properly
});