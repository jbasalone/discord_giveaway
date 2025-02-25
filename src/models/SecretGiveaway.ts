import { DataTypes, Model } from "sequelize";
import { sequelize } from "../database";

export class SecretGiveawaySettings extends Model {
    public guildId!: string;
    public enabled!: boolean;
    public categoryIds!: string; // Stored as JSON string in DB
    public summaryChannelId!: string | null; // ✅ Newly added
    public summaryMessageId!: string | null; // ✅ Newly added
}

SecretGiveawaySettings.init(
    {
        guildId: {
            type: DataTypes.STRING,
            primaryKey: true,
            allowNull: false
        },
        enabled: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: false
        },
        categoryIds: {
            type: DataTypes.TEXT, // Stored as JSON string
            allowNull: true,
            defaultValue: "[]"
        },
        summaryChannelId: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null // ✅ This allows setting summary updates
        },
        summaryMessageId: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null // ✅ Stores the message ID to update
        }
    },
    {
        sequelize,
        modelName: "SecretGiveawaySettings",
        tableName: "secret_giveaway_settings",
        timestamps: false
    }
);

