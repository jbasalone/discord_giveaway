module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    setupFilesAfterEnv: ["<rootDir>/jest.setup.js"], // Loads the test setup
    testTimeout: 30000, // Extend timeout if database queries are slow
    verbose: true, // Display detailed test output
    detectOpenHandles: true, // Helps track hanging processes
    forceExit: true, // Ensures Jest exits after running tests
};