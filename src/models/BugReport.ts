import { DataTypes, Model } from "sequelize";
import { sequelize } from "../database";

export class BugReport extends Model {
    public id!: number;
    public userId!: string;
    public type!: "Bug" | "Feature";
    public description!: string;
    public status!: "Open" | "In Progress" | "Completed";
}

BugReport.init(
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        userId: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        type: {
            type: DataTypes.ENUM("Bug", "Feature"),
            allowNull: false,
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        status: {
            type: DataTypes.ENUM("Open", "In Progress", "Completed"),
            defaultValue: "Open",
        }
    },
    {
        sequelize,
        modelName: "BugReport",
        tableName: "bug_reports",
        timestamps: false,
    }
);

export default BugReport;