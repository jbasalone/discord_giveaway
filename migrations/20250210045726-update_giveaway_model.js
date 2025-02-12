'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableDescription = await queryInterface.describeTable('Giveaways');

    if (!tableDescription.endsAt) {
      await queryInterface.addColumn('Giveaways', 'endsAt', { type: Sequelize.INTEGER, allowNull: false });
    }
    if (!tableDescription.winnerCount) {
      await queryInterface.addColumn('Giveaways', 'winnerCount', { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 });
    }
    if (!tableDescription.extraFields) {
      await queryInterface.addColumn('Giveaways', 'extraFields', { type: Sequelize.JSON, allowNull: true, defaultValue: [] });
    }
    if (!tableDescription.forceStart) {
      await queryInterface.addColumn('Giveaways', 'forceStart', { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Giveaways', 'endsAt');
    await queryInterface.removeColumn('Giveaways', 'winnerCount');
    await queryInterface.removeColumn('Giveaways', 'extraFields');
    await queryInterface.removeColumn('Giveaways', 'forceStart');
  }
};
