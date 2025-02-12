const { sequelize } = require("../database");
const { Giveaway } = require("../models/Giveaway");

beforeAll(async () => {
    console.log("🔄 Initializing test database...");
    await sequelize.authenticate(); // ✅ Ensure DB connection
    await sequelize.sync({ force: true }); // ✅ Reset DB before all tests
});

beforeEach(async () => {
    console.log("♻️ Resetting database state before test...");
    await sequelize.sync({ force: true }); // ✅ Ensure fresh DB state
});

afterEach(async () => {
    console.log("🧹 Cleaning up test data...");
    await Giveaway.destroy({ where: {} }); // ✅ Clears Giveaway table only
});

afterAll(async () => {
    console.log("🛑 Closing database connection...");
    await sequelize.close(); // ✅ Ensures Jest does not hang
});