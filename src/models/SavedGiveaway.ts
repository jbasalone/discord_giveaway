import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database';

export class SavedGiveaway extends Model {
    public id!: number;
    public guildId!: number;
    public name!: string;
    public title!: string;
    public description!: string;
    public duration!: number;
    public winnerCount!: number;
    public extraFields?: string;
    public type!: 'custom' | 'miniboss' | 'giveaway';
    public forceStart!: boolean;
    public role!: string;
    public host!: string;
    public creator!: string;
    public imageUrl?: string;
    public thumbnailUrl?: string;
    public channelId?: string;
}

SavedGiveaway.init(
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        guildId: {
            type: DataTypes.BIGINT,
            allowNull: false,
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: "unique_saved_giveaway_name",
        },
        title: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        duration: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        winnerCount: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1,
        },
        extraFields: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        type: {
            type: DataTypes.ENUM('custom', 'miniboss', 'giveaway'),
            allowNull: false,
            defaultValue: 'custom',
        },
        forceStart: {
            type: DataTypes.BOOLEAN,
            allowNull: true,
            defaultValue: false,
        },
        role: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
        },
        host: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        creator: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        imageUrl: {
            type: DataTypes.TEXT,
            allowNull: true,
            defaultValue: null,
        },
        thumbnailUrl: {
            type: DataTypes.TEXT,
            allowNull: true,
            defaultValue: null,
        },
        channelId: {
            type: DataTypes.BIGINT,
            allowNull: true,
            defaultValue: null,
        }
    },
    {
        sequelize,
        modelName: 'SavedGiveaway',
        tableName: 'saved_giveaways',
        timestamps: false,
        freezeTableName: true,
        indexes: [
            {
                unique: true,
                fields: ['name'],
                name: "unique_saved_giveaway_name",
            }
        ]
    }
);