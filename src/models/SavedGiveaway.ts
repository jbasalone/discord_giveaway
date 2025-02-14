import { DataTypes, Model } from "sequelize";
import { sequelize } from "../database";

class SavedGiveaway extends Model {
    public id!: number;
    public guildId!: string;
    public name!: string;
    public title!: string;
    public description!: string;
    public type!: "custom" | "miniboss";  // ✅ NEW: Store giveaway type
    public duration!: number;
    public winnerCount!: number;
    public forceStart?: boolean;
    public extraFields?: string;
    public role?: string;
}

SavedGiveaway.init(
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
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,  // Ensures template names are unique
        },
        title: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        type: {
            type: DataTypes.ENUM("custom", "miniboss"),  // ✅ NEW: Store `custom` or `miniboss`
            allowNull: false,
            defaultValue: "custom",  // ✅ Default to `custom`
        },
        duration: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        winnerCount: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        forceStart: {
            type: DataTypes.BOOLEAN,
            allowNull: true,
            defaultValue: false,
        },
        extraFields: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        role: {
            type: DataTypes.STRING,
            allowNull: true,
        },
    },
    {
        sequelize,
        modelName: "SavedGiveaway",
        tableName: "saved_giveaways",
        timestamps: true,
    }
);

export { SavedGiveaway };