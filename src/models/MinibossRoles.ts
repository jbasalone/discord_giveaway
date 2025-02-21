import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database';

export class MinibossRoles extends Model {
    public id!: number;
    public guildId!: string;
    public roleId!: string;
}

MinibossRoles.init(
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
        roleId: {
            type: DataTypes.STRING,
            allowNull: false
        }
    },
    {
        sequelize,
        modelName: 'MinibossRoles',
        tableName: 'miniboss_roles',
        timestamps: false,
        indexes: [
            {
                unique: true,
                fields: ['guildId', 'roleId']
            }
        ]
    }
);