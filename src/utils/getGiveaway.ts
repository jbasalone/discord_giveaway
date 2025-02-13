import { Giveaway } from "../models/Giveaway";

/**
 * Fetches a giveaway from the database by ID.
 */
export async function getGiveaway(giveawayId: string) {
    try {
        if (!giveawayId) {
            throw new Error("No giveaway ID provided.");
        }

        const giveaway = await Giveaway.findOne({ where: { id: giveawayId } });

        if (!giveaway) {
            console.warn(`⚠️ Giveaway with ID ${giveawayId} not found.`);
            return null;
        }

        return giveaway;
    } catch (error) {
        console.error("❌ Error fetching giveaway:", error);
        return null;
    }
}
