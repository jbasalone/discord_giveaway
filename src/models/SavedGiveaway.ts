import { DataTypes, Model } from "sequelize";
import { sequelize } from "../database";

class SavedGiveaway extends Model {
    public name!: string;
    public title!: string;
    public description!: string;
    public role?: string;
    public duration!: number;
    public winnerCount!: number;
    public extraFields?: string;
    public createdAt!: Date;
    public updatedAt!: Date;
}

SavedGiveaway.init(
    {
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true,  // ✅ Set `name` as the PRIMARY KEY (No `id` column needed)
        },
        title: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        role: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        duration: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        winnerCount: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        extraFields: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
        updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
    },
    {
        sequelize,
        modelName: "SavedGiveaway",
        tableName: "saved_giveaways",
        timestamps: true,  // ✅ Use timestamps (matches MySQL `createdAt` & `updatedAt`)
    }
);

export { SavedGiveaway };