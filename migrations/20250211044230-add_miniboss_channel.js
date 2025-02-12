'use strict';

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('GuildSettings', 'minibossChannelId', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('GuildSettings', 'minibossChannelId');
  }
};
