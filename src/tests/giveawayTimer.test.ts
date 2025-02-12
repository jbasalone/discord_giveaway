import { Message, Client, MessageEditOptions, EmbedBuilder } from "discord.js";
import { startLiveCountdown } from "../utils/giveawayTimer";
import { jest } from "@jest/globals";

// ✅ Properly Mocked Client
const mockClient = {} as Client;

// ✅ Correctly Typed Mock Message
const mockMessage = {
    edit: jest.fn<() => Promise<Message<true>>>().mockResolvedValue({} as Message<true>), // ✅ FIXED
    embeds: [],
} as unknown as Message<true>;

// ✅ Mock Giveaway Data
const mockGiveaway = {
    id: 1,
    participants: [{ id: "123" }, { id: "456" }],
    endsAt: Math.floor(Date.now() / 1000) + 600, // 10 minutes later
};

// ✅ Test Suite for Giveaway Timer
describe("🎉 Giveaway Timer Tests", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("✅ Should update countdown correctly", async () => {
        // ✅ Correctly Mock Message Edit
        jest.spyOn(mockMessage, "edit").mockResolvedValue(mockMessage as Message<true>);

        // Run countdown update
        await startLiveCountdown(mockGiveaway.id, mockClient);
        await expect(startLiveCountdown(mockGiveaway.id, mockClient)).resolves.not.toThrow();

        // ✅ Ensure edit was called
        expect(mockMessage.edit).toHaveBeenCalled();

        // ✅ Extract Jest Mock Call safely
        const editCall = (mockMessage.edit as jest.Mock).mock.calls[0]?.[0] as MessageEditOptions;

        // ✅ Validate Embed Structure
        if (!editCall || !editCall.embeds || editCall.embeds.length === 0) {
            throw new Error("❌ Invalid message edit call! No embeds found.");
        }

        // ✅ Extract "⏳ Ends In" Field
        const embedData = EmbedBuilder.from(editCall.embeds[0]).toJSON();
        const countdownField = embedData.fields?.find((f) => f.name === "⏳ Ends In");

        // ✅ Debugging Output
        console.log("🔍 Expected:", /^<t:\d+:R>$/);
        console.log("🔍 Received:", countdownField?.value);

        // ✅ Validate Countdown Field
        expect(countdownField?.value).toMatch(/^<t:\d+:R>$/);
    });

    test("⚠️ Should handle missing embed gracefully", async () => {
        // Reset mock message
        mockMessage.embeds = [];

        // ✅ Correctly Mock Message Edit
        jest.spyOn(mockMessage, "edit").mockResolvedValue(mockMessage as Message<true>);

        // Run countdown update
        await startLiveCountdown(mockGiveaway.id, mockClient);
        await expect(startLiveCountdown(mockGiveaway.id, mockClient)).resolves.not.toThrow();

        // ✅ Ensure edit was called
        expect(mockMessage.edit).toHaveBeenCalled();

        // ✅ Extract Jest Mock Call safely
        const editCall = (mockMessage.edit as jest.Mock).mock.calls[0]?.[0] as MessageEditOptions;

        // ✅ Validate Embed Structure
        if (!editCall || !editCall.embeds || editCall.embeds.length === 0) {
            throw new Error("❌ Invalid message edit call! No embeds found.");
        }

        // ✅ Extract "⏳ Ends In" Field
        const embedData = EmbedBuilder.from(editCall.embeds[0]).toJSON();
        const countdownField = embedData.fields?.find((f) => f.name === "⏳ Ends In");

        // ✅ Debugging Output
        console.log("🔍 Expected:", /^<t:\d+:R>$/);
        console.log("🔍 Received:", countdownField?.value);

        // ✅ Validate Countdown Field
        expect(countdownField?.value).toMatch(/^<t:\d+:R>$/);
    });

    test("❌ Should handle errors gracefully", async () => {
        // ✅ Correctly Mock an Error
        jest.spyOn(mockMessage, "edit").mockRejectedValue(new Error("Mock error"));

        // ✅ Ensure No Crash
        await startLiveCountdown(mockGiveaway.id, mockClient);
        await expect(startLiveCountdown(mockGiveaway.id, mockClient)).resolves.not.toThrow();
        console.log("✅ Handled error correctly!");

        // ✅ Ensure edit was called
        expect(mockMessage.edit).toHaveBeenCalled();
    });
});