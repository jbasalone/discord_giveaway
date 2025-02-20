import { DataTypes, Model } from "sequelize";
import { sequelize } from "../database";

export class ExtraEntries extends Model {
    public guildId!: string;
    public roleId!: string;
    public bonusEntries!: number;
}

ExtraEntries.init(
    {
        guildId: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true,
        },
        roleId: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true,
        },
        bonusEntries: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1,
        },
    },
    {
        sequelize,
        modelName: "ExtraEntries",
        tableName: "extra_entries",
        timestamps: false,
        freezeTableName: true, 
    }
);