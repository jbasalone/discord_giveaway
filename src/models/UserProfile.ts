import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database';

export class UserProfile extends Model {
    public userId!: string;
    public userLevel!: number;
    public ttLevel!: number; // ✅ NEW FIELD
}

UserProfile.init(
    {
        userId: {
            type: DataTypes.STRING,
            primaryKey: true
        },
        userLevel: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        ttLevel: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        }
    },
    {
        sequelize,
        modelName: 'UserProfile',
        tableName: 'user_profiles',
        timestamps: false
    }
);