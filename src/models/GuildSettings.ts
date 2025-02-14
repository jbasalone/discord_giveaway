import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database';

class GuildSettings extends Model {
    public guildId!: string;
    public defaultGiveawayRoleId!: string | null;
    public prefix!: string;
    public minibossChannelId!: string | null;
    public allowedRoles!: string | null;  // ✅ New: JSON for roles that can start GAs
    public roleMappings!: string | null;  // ✅ New: JSON for role pings
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
    },
    allowedRoles: {
        type: DataTypes.TEXT,  // ✅ JSON string of roles who can start GAs
        allowNull: true,
        defaultValue: "{}"
    },
    roleMappings: {
        type: DataTypes.TEXT,  // ✅ JSON string of role mappings for pings
        allowNull: true,
        defaultValue: "{}"
    }
}, {
    sequelize,
    modelName: 'GuildSettings',
    tableName: 'guild_settings',
    timestamps: false,
    freezeTableName: true
});

export { GuildSettings };