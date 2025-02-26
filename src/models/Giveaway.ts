import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database';

export class Giveaway extends Model {
    public id!: number;
    public guildId!: string;
    public host!: string;
    public channelId!: string;
    public messageId!: string;
    public title!: string;
    public description!: string;
    public type!: 'custom' | 'miniboss' | 'giveaway';
    public duration!: number;
    public endsAt!: number;
    public participants!: string;
    public guaranteedWinners!: string;
    public winnerCount!: number;
    public extraFields!: string | null;
    public forceStart!: boolean;
    public useExtraEntries!: boolean;  // ✅ Add this field
}

Giveaway.init(
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        guildId: {
            type: DataTypes.STRING,
            allowNull: false
        },
        host: {
            type: DataTypes.STRING,
            allowNull: false
        },
        channelId: {
            type: DataTypes.STRING,
            allowNull: false
        },
        messageId: {
            type: DataTypes.STRING,
            allowNull: false
        },
        title: {
            type: DataTypes.STRING,
            allowNull: false
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        type: {
            type: DataTypes.ENUM('custom', 'miniboss', 'giveaway'),
            allowNull: false,
            defaultValue: 'custom'
        },
        duration: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        endsAt: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        participants: {
            type: DataTypes.TEXT,
            allowNull: false,
            defaultValue: "[]"
        },
        guaranteedWinners: {
            type: DataTypes.TEXT,
            allowNull: true,
            defaultValue: "[]"
        },
        winnerCount: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1
        },
        extraFields: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        forceStart: {
            type: DataTypes.BOOLEAN,
            allowNull: true,
            defaultValue: false
        },
        useExtraEntries: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        }
    },
    {
        sequelize,
        modelName: 'Giveaway',
        tableName: 'giveaways',
        timestamps: false
    }
);

export default Giveaway;