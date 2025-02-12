'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.addColumn('Giveaways', 'guildId', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: "000000000000000000" // Temporary default, replace later
    });
  },
  down: async (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('Giveaways', 'guildId');
  }
};
