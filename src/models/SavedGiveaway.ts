import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database';

export class SavedGiveaway extends Model {
    declare id: number;
    declare guildId: string;
    declare hostId: string;
    declare name: string;
    declare title: string;
    declare description: string;
    declare duration: number;
    declare winnerCount: number;
    declare roleId: string;
    declare extraFields: string;
}

SavedGiveaway.init(
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        guildId: { type: DataTypes.STRING, allowNull: false },
        hostId: { type: DataTypes.STRING, allowNull: false },
        name: { type: DataTypes.STRING, allowNull: false },
        title: { type: DataTypes.STRING, allowNull: false },
        description: { type: DataTypes.STRING, allowNull: false, defaultValue: "React to enter!" },
        duration: { type: DataTypes.INTEGER, allowNull: false },
        winnerCount: { type: DataTypes.INTEGER, allowNull: false },
        roleId: { type: DataTypes.STRING, allowNull: false },
        extraFields: {
            type: DataTypes.TEXT,
            allowNull: false,
            defaultValue: "[]",
            get() {
                return JSON.parse(this.getDataValue("extraFields") || "[]");
            },
            set(value: string | object) {
                this.setDataValue("extraFields", JSON.stringify(value));
            }
        }
    },
    {
        sequelize,
        modelName: 'SavedGiveaway',
        tableName: 'saved_giveaways',
        timestamps: false
    }
);
