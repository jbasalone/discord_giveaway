import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../database';

interface GiveawayAttributes {
    id: number;
    guildId: string;
    host: string;
    channelId: string;
    messageId: string;
    title: string;
    description: string;
    type: 'custom' | 'miniboss' | 'giveaway'; // ✅ Add this line
    duration: number;
    endsAt: number;
    participants: string;
    winnerCount: number;
    extraFields?: string;
    forceStart?: boolean;
}

interface GiveawayCreationAttributes extends Optional<GiveawayAttributes, 'id'> {}

class Giveaway extends Model<GiveawayAttributes, GiveawayCreationAttributes> implements GiveawayAttributes {
    public id!: number;
    public guildId!: string;
    public host!: string;
    public channelId!: string;
    public messageId!: string;
    public title!: string;
    public description!: string;
    public type!: 'custom' | 'miniboss' | 'giveaway'; // ✅ Add this line
    public duration!: number;
    public endsAt!: number;
    public participants!: string;
    public winnerCount!: number;
    public extraFields?: string;
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
            allowNull: false,
        },
        messageId: {
            type: DataTypes.STRING,
            allowNull: false,
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
            type: DataTypes.ENUM('custom', 'miniboss', 'giveaway'), // ✅ Ensure `type` is stored correctly in the DB
            allowNull: false,
            defaultValue: 'custom',
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
            defaultValue: '[]',
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
        forceStart: {
            type: DataTypes.BOOLEAN,
            allowNull: true,
            defaultValue: false,
        },
    },
    {
        sequelize,
        modelName: 'Giveaway',
        tableName: 'giveaways',
        timestamps: false,
        freezeTableName: true,
    }
);

export { Giveaway };