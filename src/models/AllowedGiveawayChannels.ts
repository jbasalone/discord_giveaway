import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database';

export class AllowedGiveawayChannels extends Model {
    public id!: number;
    public guildId!: string;
    public channelId!: string;
}

AllowedGiveawayChannels.init(
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
        channelId: {
            type: DataTypes.STRING,
            allowNull: false
        }
    },
    {
        sequelize,
        modelName: 'AllowedGiveawayChannels',
        tableName: 'allowed_giveaway_channels',
        timestamps: false
    }
);