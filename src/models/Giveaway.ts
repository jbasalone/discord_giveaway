import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../database";

interface GiveawayAttributes {
    id: number;
    guildId: string;
    host: string;
    channelId: string;
    messageId: string;
    title: string;
    description: string;
    role?: string | null;
    duration: number;
    endsAt: number;
    participants: string;
    winnerCount: number;
    extraFields?: string | null;
    forceStart?: boolean;
}

// ✅ Ensure the primary key is correct
interface GiveawayCreationAttributes extends Optional<GiveawayAttributes, "id"> {}

class Giveaway extends Model<GiveawayAttributes, GiveawayCreationAttributes> implements GiveawayAttributes {
    public id!: number;
    public guildId!: string;
    public host!: string;
    public channelId!: string;
    public messageId!: string;
    public title!: string;
    public description!: string;
    public role?: string | null;
    public duration!: number;
    public endsAt!: number;
    public participants!: string;
    public winnerCount!: number;
    public extraFields?: string | null;
    public forceStart?: boolean;
}

Giveaway.init(
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        guildId: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        host: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        channelId: {
            type: DataTypes.STRING,
            allowNull: false,  // ✅ Ensure channelId is NOT NULL
        },
        messageId: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        title: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        description: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        role: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,  // ✅ Fix NULL/Undefined issues
        },
        duration: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        endsAt: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        participants: {
            type: DataTypes.TEXT,
            allowNull: false,
            defaultValue: "[]", // ✅ Ensure empty array is default
        },
        winnerCount: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        extraFields: {
            type: DataTypes.TEXT,
            allowNull: true,
            defaultValue: null,  // ✅ Fix NULL handling
        },
        forceStart: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
    },
    {
        sequelize,
        modelName: "Giveaway",
        tableName: "Giveaways",  // ✅ Ensure correct table name
        timestamps: false,
    }
);

// ✅ **Force Sync the Model (FIXED)**
async function syncGiveawayModel(): Promise<void> {
    try {
        console.log("🔄 Syncing Giveaway model...");
        await Giveaway.sync({ alter: true });
        console.log("✅ Giveaway model synced successfully!");
    } catch (error) {
        console.error("❌ Error syncing Giveaway model:", error);
    }
}

// ✅ **Properly Await Sync in App Entry**
(async () => {
    await syncGiveawayModel();
})();

export { Giveaway };