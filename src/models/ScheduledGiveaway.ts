import { DataTypes, Model } from "sequelize";
import { sequelize } from "../database";

export class ScheduledGiveaway extends Model {
    public id!: number;
    public guildId!: string;
    public channelId!: string;
    public title!: string;
    public type!: "template" | "custom";
    public templateId!: number | null;
    public duration!: number;
    public winnerCount!: number;
    public extraFields!: string | null;
    public scheduleTime!: Date;
    public repeatInterval!: "none" | "hourly" | "daily" | "weekly" | "monthly";
    public repeatDay!: number | null;
    public repeatTime!: string | null;
    public repeatCount!: number | null;
    public host!: string;
    public args!: string;
    public role!: string | null;
    public reminderSent!: boolean;
}

ScheduledGiveaway.init(
    {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        guildId: { type: DataTypes.STRING, allowNull: false },
        channelId: { type: DataTypes.STRING, allowNull: false },
        title: { type: DataTypes.STRING, allowNull: false },
        type: { type: DataTypes.ENUM("template", "custom"), allowNull: false },
        templateId: { type: DataTypes.INTEGER, allowNull: true },
        duration: { type: DataTypes.INTEGER, allowNull: false },
        winnerCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
        extraFields: { type: DataTypes.TEXT, allowNull: true },
        scheduleTime: { type: DataTypes.DATE, allowNull: false },
        repeatInterval: {
            type: DataTypes.ENUM("none", "hourly", "daily", "weekly", "monthly"),
            allowNull: false,
            defaultValue: "none",
        },
        repeatDay: { type: DataTypes.INTEGER, allowNull: true },
        repeatTime: { type: DataTypes.STRING, allowNull: true },
        repeatCount: { type: DataTypes.INTEGER, allowNull: true },
        host: { type: DataTypes.STRING, allowNull: false },
        args: { type: DataTypes.TEXT, allowNull: true },
        role: { type: DataTypes.STRING, allowNull: true },
        reminderSent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
    {
        sequelize,
        modelName: "ScheduledGiveaway",
        tableName: "scheduled_giveaways",
        timestamps: false,
        freezeTableName: true,
    }
);