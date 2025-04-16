import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  MessageFlags,
} from 'discord.js';
import dotenv from 'dotenv';
import { connectDB } from './database';
import { handleGiveawayEnd } from './events/giveawayEnd';
import { getGuildPrefix } from './utils/getGuildPrefix';
import { Giveaway } from './models/Giveaway';
import { Op } from 'sequelize';
import { handleSecretGiveawayButton } from "./events/handleSecretGiveawayButton";
import { handleSelectMenu, handleModal, handleButton } from "./commands/editTemplate";

// ✅ Giveaway Scheduling Commands
import { execute as executeScheduleGiveaway } from './commands/scheduleGiveaway';
import { execute as executeListSchedule } from './commands/listSchedule';
import { execute as executeCancelSchedule } from './commands/cancelSchedule';
import { checkScheduledGiveaways } from './utils/checkScheduledGiveaways';


import { execute as executeSetLevel } from './commands/setLevel';
import { execute as executeStartTemplate } from './commands/startTemplate';
import { execute as executeSetRole } from './commands/setRole';
import { execute as executeSaveTemplate } from './commands/saveTemplate';
import { execute as executeListTemplates } from './commands/listTemplates';
import { execute as executeDeleteTemplate } from './commands/deleteTemplate';
import { execute as executeShowConfig } from './commands/showConfig';
import { execute as executeHelp, handleHelpSelection } from './commands/help';
import { execute as executeReroll } from './commands/reroll';
import { execute as executeSetExtraEntries } from './commands/setExtraEntries';
import { execute as executeGiveaway } from './commands/giveaway';
import { execute as executeCustomGiveaway } from './commands/customGiveaway';
import { execute as executeMinibossGiveaway } from './commands/minibossGiveaway';
import { execute as executeSetMinibossChannel } from './commands/setMinibossChannel';
import { execute as executeListRoles } from './commands/listRoles';
import { execute as executeListGiveaways } from './commands/checkGiveaway';
import { execute as executeBlacklistedRoles } from './commands/setBlacklistedRoles';
import { execute as executesetChannel } from './commands/setChannel';
import { execute as executeListMBRoles } from './commands/listMinibossRoles';
import { execute as executeMyLevel } from './commands/myLevel';
import { execute as executeSetAccess } from './commands/BotAccess';
import { execute as executeListAccess } from './commands/listAuthorizedGuilds';
import { execute as executeSetSecret } from './commands/setSecret';
import { execute as executeStartSecret } from './commands/startSecretGiveaway';
import { execute as executeSetSummary } from './commands/setSummary';
import { execute as executeBugCreate } from './commands/bugs';
import { execute as executeUpdateBug } from './commands/updateBug';
import { execute as executeEditTemplate } from './commands/editTemplate';
import { execute as executeRequestGiveaway } from './commands/submitGiveaway';
import { execute as executeApproveGiveaway } from './commands/pendingGiveaways'
import { execute as executeSetTTRoles } from './commands/setMinibossRoles'
import { execute as executeForceEnd } from './commands/forceGiveawayEnd'
import { execute as executeUserStats } from './commands/stats'
import { execute as executeCancelGA } from './commands/cancelGA'
import { execute as executeStartUp } from './commands/startupGuide'

import { handleMinibossCommand } from './events/handleMinibossCommnand';
import { executeJoinLeave } from './events/giveawayJoin';

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

async function startBot() {
  try {
    console.log("🔗 Connecting to Database...");
    await connectDB();

    client.once(Events.ClientReady, async () => {
      console.log(`✅ Bot is online! Logged in as ${client.user?.tag}`);

      setInterval(async () => {

        const currentTime = Math.floor(Date.now() / 1000);
        const expiredGiveaways = await Giveaway.findAll({
          where: { endsAt: { [Op.lte]: currentTime } }
        });

        for (const giveaway of expiredGiveaways) {
          console.log(`⏳ Expired Giveaway Found: ID ${giveaway.get("id")}`);
          await handleGiveawayEnd(client, giveaway.get("id"));
        }
      }, 30 * 1000);
      setInterval(async () => {
        await checkScheduledGiveaways(client);
      }, 30 * 1000);
    });



    client.on(Events.MessageCreate, async (message) => {
      if (message.author.bot || !message.guild) return;

      const guildId = message.guild.id;
      let prefix = await getGuildPrefix(guildId) || "!ga";

      if (!message.content.startsWith(prefix)) return;

      const args = message.content.slice(prefix.length).trim().split(/\s+/);
      const subCommand = args.shift()?.toLowerCase();

      if (subCommand !== 'ga') return;

      const command = args.shift()?.toLowerCase();

      console.log(`🔍 Command Detected: "${command}" with Args: [${args.join(', ')}]`);

      try {
        switch (command) {
          case 'schedule':
            await executeScheduleGiveaway(message, args);
            break;
          case 'listschedule': case 'listscheduled': case 'scheduled':
            await executeListSchedule(message, args);
            break;
          case 'cancelschedule': case 'cancels':
            await executeCancelSchedule(message, args);
            break;
          case 'bug':
            await executeBugCreate(message);
            break;
          case 'cancel': case 'cancelga': case 'cga':
            await executeCancelGA(message, args)
            break;
          case 'create': case 'quick':
            await executeGiveaway(message, args);
            break;
          case 'custom':
            await executeCustomGiveaway(message, args);
            break;
          case 'check': case 'listgiveaway': case 'listga': case 'giveaways':
            await executeListGiveaways(message, args);
            break;
          case 'delete': case 'deletetemplate':
            await executeDeleteTemplate(message, args)
            break;
          case 'edit':
            await executeEditTemplate(message, args);
            break;
          case 'end': case 'forceend':
            await executeForceEnd(message, args);
            break;
          case 'help':
            await executeHelp(message);
            break;
          case 'listaccess':
            await executeListAccess(message);
            break;
          case 'listroles': case 'roles':
            await executeListRoles(message);
            break;
          case 'listmbroles':
            await executeListMBRoles(message, guildId);
            break;
          case 'listtemplates': case 'listtemp': case 'listtemplate':
            await executeListTemplates(message, args);
            break;
          case 'miniboss': case 'mb':
            await executeMinibossGiveaway(message, args);
            break;
          case 'mylevel':
            await executeMyLevel(message);
            break;
          case 'pending': case 'requests':
            await executeApproveGiveaway(message);
            break;
          case 'reroll':
            await executeReroll(message, args);
            break;
          case 'save':
            await executeSaveTemplate(message, args);
            break;
          case 'showconfig': case 'config':
            await executeShowConfig(message, guildId);
            break;
          case 'setblacklist': case 'setblacklistedroles': case 'setbl':
            await executeBlacklistedRoles(message, args, guildId);
            break;
          case 'setbotaccess':
            await executeSetAccess(message, args);
            break;
          case 'setchannel': case 'setch':
            await executesetChannel(message, args);
            break;
          case 'setextraentry': case 'setentry':
            await executeSetExtraEntries(message, args, guildId);
            break;
          case 'setlevel': case 'level':
            await executeSetLevel(message, args);
            break;
          case 'setminibosschannel': case 'setmbch': case 'mbch':
            await executeSetMinibossChannel(message, args);
            break;
          case 'setminibossroles': case 'setmbroles':
            await executeSetTTRoles(message, args)
            break;
          case 'setsecret':
            await executeSetSecret(message, args);
            break;
          case 'setrole': case 'setroles':
            await executeSetRole(message, args);
            break;
          case 'setsummary':
            await executeSetSummary(message, args);
            break;
          case 'startsecret': case 'secret':
            await executeStartSecret(message, args);
            break;
          case 'starttemplate': case 'start':
            await executeStartTemplate(message, args);
            break;
          case 'startup': case 'guide':
            await executeStartUp(message)
            break;
          case 'stats': case 'mystats': case 'stat':
            await executeUserStats(message, args)
            break;
          case 'submitga': case 'submit':
            await executeRequestGiveaway(message);
            break;
          case 'update':
            await executeUpdateBug(message, args);
            break;
          default:
            await message.reply(`❌ Unknown command. Use \`${prefix} ga help\` to see available commands.`);
        }
      } catch (error) {
        console.error(`❌ Error executing command '${command}':`, error);
        await message.reply("❌ An error occurred while processing your command.");
      }
    });



    client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit()) return;

      try {
        if (interaction.isStringSelectMenu()) {
          if (interaction.customId === "help-menu") {
            await handleHelpSelection(interaction);
          } else if (interaction.customId.startsWith("edit-template-")) {
            await handleSelectMenu(interaction);
          }
        } else if (interaction.isModalSubmit() && interaction.customId.startsWith("edit-template-modal-")) {
          await handleModal(interaction);
        } else if (interaction.isButton()) {
          if (interaction.customId.startsWith("preview-") || interaction.customId.startsWith("save-") || interaction.customId.startsWith("exit-")) {
            await handleButton(interaction); // ✅ Handle Save & Exit or Preview buttons
          } else if (interaction.customId.startsWith("miniboss-")) {
            const giveawayId = interaction.customId.split("-").pop();
            if (!giveawayId) {
              return interaction.reply({ content: "❌ Invalid Miniboss Giveaway ID.", ephemeral: true });
            }

            const giveaway = await Giveaway.findByPk(parseInt(giveawayId));
            if (!giveaway) {
              return interaction.reply({ content: "❌ Giveaway not found.", ephemeral: true });
            }

            const participants = JSON.parse(giveaway.get("participants") ?? "[]");
            console.log(`🔍 Calling handleMinibossCommand (Participants: ${participants.length})`);
            await handleMinibossCommand(client, parseInt(giveawayId), participants);
          } else if (interaction.customId.startsWith("secret-")) {
            await handleSecretGiveawayButton(interaction);
          } else {
            await executeJoinLeave(interaction);
          }
        }
      } catch (error) {
        console.error("❌ Error handling interaction:", error);
        await interaction.reply({ content: "❌ An error occurred.", flags: MessageFlags.SuppressEmbeds });
      }
    });


    await client.login(process.env.DISCORD_TOKEN);
  } catch (error) {
    console.error("❌ Fatal error during startup:", error);
  }
}

// ✅ Ensures startBot is awaited and handled correctly
export { client };

(async () => {
  try {
    await startBot();
  } catch (error) {
    console.error("❌ Critical error during bot startup:", error);
  }
})();