import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database';

class Giveaway extends Model {
    public id!: number;
    public guildId!: string;
    public host!: string;
    public channelId!: string;
    public messageId!: string | null;
    public title!: string;
    public description!: string;
    public role!: string | null;
    public duration!: number;
    public endsAt!: number;
    public participants!: string;
    public winnerCount!: number;
    public extraFields!: string | null;
    public forceStart!: boolean;
}

Giveaway.init({
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
        allowNull: true
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.STRING,
        allowNull: false
    },
    role: {
        type: DataTypes.STRING,
        allowNull: true
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
    winnerCount: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    extraFields: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    forceStart: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    }
}, {
    sequelize,
    modelName: 'Giveaway',
    tableName: 'Giveaways',
    timestamps: false
});

export { Giveaway };