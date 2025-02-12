import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

// ✅ Validate environment variables & throw explicit error if missing
if (!process.env.MYSQL_DATABASE || !process.env.MYSQL_USER || !process.env.MYSQL_PASSWORD || !process.env.MYSQL_HOST) {
    console.error("❌ Missing required database environment variables. Check your .env file.");
    process.exit(1);
}

export const sequelize = new Sequelize(
    process.env.MYSQL_DATABASE,
    process.env.MYSQL_USER,
    process.env.MYSQL_PASSWORD,
    {
        host: process.env.MYSQL_HOST,
        dialect: "mysql",
        logging: false,
        define: {
            timestamps: false,  // ✅ Ensures models don't create `createdAt` & `updatedAt` unless needed
            freezeTableName: true  // ✅ Prevents Sequelize from pluralizing table names
        },
        dialectOptions: {
            connectTimeout: 60000 // ✅ Increases MySQL connection timeout (useful for larger datasets)
        }
    }
);

export async function closeDB() {
    try {
        await sequelize.close();
        console.log("✅ Database connection closed.");
    } catch (error) {
        console.error("❌ Error closing database connection:", error);
    }
}

export async function connectDB() {
    try {
        await sequelize.authenticate();
        console.log("✅ Database connected successfully.");

        // ✅ Safer sync to avoid unintended table modifications
        await sequelize.sync({ force: false });  // ⚠️ Change to `true` only if you want to **drop & recreate** tables!
        console.log("✅ All tables synchronized.");
    } catch (error) {
        console.error("❌ Database connection error:", error);
        process.exit(1);
    }
}