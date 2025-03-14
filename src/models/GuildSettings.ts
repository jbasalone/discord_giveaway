import { DataTypes, Model } from "sequelize";
import { sequelize } from "../database";

export class GuildSettings extends Model {
    public guildId!: string;
    public defaultGiveawayRoleId!: string | null;
    public defaultGiveawayChannelId!: string | null;
    public minibossChannelId!: string | null;
    public allowedRoles!: string;
    public roleMappings!: string;
    public prefix!: string;
    public ttLevelRoles!: string;

}

GuildSettings.init(
    {
        guildId: {type: DataTypes.STRING, primaryKey: true},
        defaultGiveawayRoleId: {type: DataTypes.STRING, allowNull: true},
        defaultGiveawayChannelId: {type: DataTypes.STRING, allowNull: true},
        minibossChannelId: {type: DataTypes.STRING, allowNull: true},
        allowedRoles: {type: DataTypes.TEXT, allowNull: false},
        roleMappings: {type: DataTypes.TEXT, allowNull: false},
        ttLevelRoles: { type: DataTypes.TEXT, allowNull: true },
        prefix: {type: DataTypes.STRING, allowNull: false, defaultValue: "!ga"
        },
    },
    {
        sequelize,
        modelName: "GuildSettings",
        tableName: "guild_settings",
        timestamps: false,
    }
);