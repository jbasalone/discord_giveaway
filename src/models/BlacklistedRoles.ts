import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database';

export class BlacklistedRoles extends Model {
    public guildId!: string;
    public roleId!: string;
}

BlacklistedRoles.init(
    {
        guildId: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true
        },
        roleId: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true
        }
    },
    {
        sequelize,
        modelName: 'BlacklistedRoles',
        tableName: 'blacklisted_roles',
        timestamps: false
    }
);

