import { Giveaway } from "../models/Giveaway";
import { Op } from "sequelize"; // ✅ Import Sequelize's Op for OR queries

/**
 * Fetch a single giveaway from the database by either `giveawayId` or `messageId`.
 */
export async function getGiveaway(identifier: string) {
    try {
        if (!identifier) {
            throw new Error("No giveaway identifier provided.");
        }

        // ✅ Search by either `id` (Giveaway ID) or `messageId` (Discord Message ID)
        const giveaway = await Giveaway.findOne({
            where: {
                [Op.or]: [
                    { id: identifier },        // Search by Giveaway ID
                    { messageId: identifier } // Search by Message ID
                ]
            }
        });

        if (!giveaway) {
            console.warn(`⚠️ Giveaway with ID/MessageID ${identifier} not found.`);
            return null;
        }

        return giveaway.toJSON(); // ✅ Convert to plain object for safe use
    } catch (error) {
        console.error("❌ Error fetching giveaway:", error);
        return null;
    }
}

/**
 * Fetches all active giveaways from the database.
 */
export async function getAllGiveaways() {
    try {
        const activeGiveaways = await Giveaway.findAll();

        if (!activeGiveaways.length) {
            console.warn("⚠️ No active giveaways found.");
            return [];
        }

        return activeGiveaways.map(giveaway => giveaway.toJSON()); // ✅ Convert each to a plain object
    } catch (error) {
        console.error("❌ Error fetching all giveaways:", error);
        return [];
    }
}