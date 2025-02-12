import { runTest } from '../testGiveaway';
import { sequelize } from '../database';

describe('Full Giveaway System Test', () => {
  test('Runs Giveaway Countdown Test', async () => {
    await runTest();
  });
});

beforeEach(async () => {
  await sequelize.authenticate(); // ✅ Ensure DB is connected before syncing
  await sequelize.sync({ force: true }); // ✅ Fully resets database before each test
});

test('✅ Full Giveaway System Test', async () => {
  await expect(runTest()).resolves.not.toThrow();
});

afterEach(async () => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  await sequelize.close(); // ✅ Ensures DB connections close after tests
});