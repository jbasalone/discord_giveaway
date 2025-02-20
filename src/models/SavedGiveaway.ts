import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database';

export class SavedGiveaway extends Model {
    public id!: number;
    declare public guildId: number;
    public name!: string;
    public title!: string;
    public description!: string;
    public duration!: number;
    public winnerCount!: number;
    public extraFields?: string;
    public type!: 'custom' | 'miniboss' | 'giveaway';
    public forceStart!: boolean;
    public host!: string;
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
            unique: true,
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
            allowNull: false,
        },
        host: {
            type: DataTypes.STRING,
            allowNull: false,
        }
    },
    {
        sequelize,
        modelName: 'SavedGiveaway',
        tableName: 'saved_giveaways',
        timestamps: false,
        freezeTableName: true,
    }
);