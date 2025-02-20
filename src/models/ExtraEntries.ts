import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database';

class ExtraEntries extends Model {
  public guildId!: string;
  public roleId!: string;
  public bonusEntries!: number;
}

ExtraEntries.init({
  guildId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  roleId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  bonusEntries: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  }
}, {
  sequelize,
  modelName: 'ExtraEntries',
  tableName: 'extra_entries',
  timestamps: false,
  freezeTableName: true,
});

export { ExtraEntries };