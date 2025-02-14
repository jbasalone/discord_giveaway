import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database';

class GuildSettings extends Model {
    public guildId!: string;
    public defaultGiveawayRoleId!: string | null;
    public prefix!: string;
    public minibossChannelId!: string | null;
}

GuildSettings.init({
    guildId: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true
    },
    defaultGiveawayRoleId: {
        type: DataTypes.STRING,
        allowNull: true
    },
    prefix: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "!ga"
    },
    minibossChannelId: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    sequelize,
    modelName: 'GuildSettings',
    tableName: 'guild_settings',  // ✅ Enforce correct table name
    timestamps: false,
    freezeTableName: true // ✅ Ensures Sequelize does NOT rename it
});

export { GuildSettings };