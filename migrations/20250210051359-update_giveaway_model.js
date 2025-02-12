'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableDescription = await queryInterface.describeTable('Giveaways');

    if (!tableDescription.forceStart) {
      await queryInterface.addColumn('Giveaways', 'forceStart', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    if (!tableDescription.participants) {
      await queryInterface.changeColumn('Giveaways', 'participants', {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: [],
      });
    }

    if (!tableDescription.extraFields) {
      await queryInterface.changeColumn('Giveaways', 'extraFields', {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: [],
      });
    }
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('Giveaways', 'forceStart');
  },
};
