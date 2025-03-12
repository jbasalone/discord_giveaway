# 🎉 Giveaway System

This is a **Discord Giveaway System** that allows server administrators to create, manage, and automate giveaways using various commands. The system includes custom templates, scheduled giveaways, blacklisted roles, extra entry support, and more.

---

## 📂 **Directory Structure**

```
📁 giveaway_system/
 ├── 📁 commands/                 # Handles different giveaway commands
 │    ├── giveaway.ts             # Standard giveaway creation command
 │    ├── customGiveaway.ts       # Custom giveaway with extra fields
 │    ├── checkGiveaway.ts        # Lists or checks giveaways
 │    ├── setBlacklistedRoles.ts  # Sets blacklisted roles for giveaways
 │    ├── setExtraEntries.ts      # Manages extra entry settings
 │    ├── reroll.ts               # Rerolls winners of an ended giveaway
 │    ├── listRoles.ts            # Lists all eligible giveaway roles
 │    ├── listTemplates.ts        # Lists saved giveaway templates
 │    ├── scheduleGiveaway.ts     # Schedules giveaways
 │    ├── cancelSchedule.ts       # Cancels a scheduled giveaway
 │    ├── editTemplate.ts         # Edits saved giveaway templates
 │    ├── startTemplate.ts        # Starts a giveaway from a template
 │    ├── deleteTemplate.ts       # Deletes a saved giveaway template
 │    ├── help.ts                 # Displays help and command usage
 │    ├── showConfig.ts           # Shows the current server's giveaway settings
 │    ├── myLevel.ts              # Displays user level
 │    ├── bugs.ts                 # Allows reporting bugs in giveaways
 ├── 📁 events/                   # Handles Discord bot events
 │    ├── giveawayEnd.ts          # Manages giveaway completion
 │    ├── giveawayJoin.ts         # Handles user joining/leaving giveaways
 │    ├── handleButton.ts         # Processes button interactions
 │    ├── handleModal.ts          # Processes modal submissions
 │    ├── handleSelectMenu.ts     # Handles selection menus
 │    ├── handleSecretGiveaway.ts # Manages secret giveaways
 ├── 📁 models/                   # Database models for giveaways
 │    ├── Giveaway.ts             # Giveaway schema
 │    ├── BlacklistedRoles.ts     # Blacklisted roles schema
 │    ├── GuildSettings.ts        # Server settings schema
 │    ├── AllowedGiveawayChannels.ts  # List of allowed giveaway channels
 │    ├── SavedGiveaway.ts        # Giveaway template schema
 ├── 📁 utils/                     # Utility functions
 │    ├── getGiveaway.ts          # Fetches giveaway details from DB
 │    ├── giveawayCache.ts        # Caches active giveaways
 │    ├── giveawayTimer.ts        # Handles live giveaway countdowns
 │    ├── getGuildPrefix.ts       # Retrieves a server’s giveaway prefix
 │    ├── convertTime.ts          # Converts time formats
 │    ├── checkScheduledGiveaways.ts  # Runs scheduled giveaways
 ├── database.ts                   # Database connection
 ├── index.ts                      # Bot startup and command handling
 ├── README.md                     # Project documentation
```

---

## 📜 **Usage & Commands**

### **🎁 Giveaway Creation**
| Command | Description |
|---------|------------|
| `!ga create "Giveaway Title" 30m 1` | Creates a standard giveaway with a title, duration, and winner count. |
| `!ga custom "Giveaway Title" 1h 1 --field "Requirement: Level 50+" --role VIP` | Creates a giveaway with extra conditions, such as required roles or extra fields. |
| `!ga starttemplate <template_id>` | Starts a giveaway using a saved template. |

### **🦇 Miniboss Giveaways (Epic RPG Integration)**
Miniboss giveaways are designed for **Epic RPG** boss defeat to drop in game coin. These giveaways:
- **Encourage Epic RPG server participation** 📢
- **Automatically track event entries** 🏆
- **Can be limited to specific roles** (e.g., `@RPG Master`)
- **Support countdowns and automated winner selection** 🎉

| Command | Description |
|---------|------------|
| `!ga miniboss "Dragon Raid" 3h 1` | Creates a miniboss giveaway for Epic RPG players. |

### **📊 Giveaway Management**
| Command | Description |
|---------|------------|
| `!ga check` | Lists all active giveaways in the server. |
| `!ga check <giveaway_id>` | Checks the details of a specific giveaway. |
| `!ga reroll <giveaway_id>` | Rerolls winners for a completed giveaway. |
| `!ga cancel <giveaway_id>` | Cancels an ongoing giveaway. |

### **🔧 Giveaway Configuration**
| Command | Description |
|---------|------------|
| `!ga setblacklistedroles @Role1 @Role2` | Prevents users with these roles from joining giveaways. |
| `!ga setextraentries <value>` | Adjusts extra entries for giveaways. |
| `!ga setchannel #giveaways` | Sets the designated giveaway channel. |
| `!ga showconfig` | Displays the current giveaway settings for the server. |

### **💾 Saved Giveaways & Templates**
| Command | Description |
|---------|------------|
| `!ga listtemplates` | Lists saved giveaway templates. |
| `!ga savetemplate <template_name>` | Saves a giveaway setup as a reusable template. |
| `!ga deletetemplate <template_id>` | Deletes a saved template. |
| `!ga edittemplate <template_id>` | Edits an existing template. |

### **🕒 Scheduled Giveaways**
| Command | Description |
|---------|------------|
| `!ga schedule "Giveaway Title" 1h 1` | Schedules a giveaway for a future time. |
| `!ga listschedule` | Lists all scheduled giveaways. |
| `!ga cancelschedule <schedule_id>` | Cancels a scheduled giveaway. |

### **🛠️ Admin & Debugging**
| Command | Description |
|---------|------------|
| `!ga listroles` | Lists all eligible giveaway roles. |
| `!ga mylevel` | Displays a user’s giveaway participation level. |
| `!ga bugs` | Reports a bug related to giveaways. |

---

## ⚙️ **Setup & Installation**

1. **Clone the Repository**
   ```sh
   git clone https://github.com/jbasalone/discord_giveaway.git
   cd giveaway_system
   ```

2. **Install Dependencies**
   ```sh
   npm install
   ```

3. **Setup Environment Variables**
    - Create a `.env` file and configure it with:
   ```env
   DISCORD_TOKEN=your_discord_bot_token
   DATABASE_URL=mysql://user:password@host:port/database_name
   ```

4. **Run Database Migrations**
   ```sh
   npx sequelize-cli db:migrate
   ```

5. **Start the Bot**
   ```sh
   npm start
   ```

---

## 🛠️ **Technology Stack**
- **Node.js** (Backend runtime)
- **Discord.js** (Discord bot framework)
- **Sequelize ORM** (Database ORM)
- **MySQL / PostgreSQL** (Database support)

---

## 📜 **License**
This project is licensed under the MIT License.

---

## 📝 **Contributing**
1. Fork the repository.
2. Create a feature branch.
3. Commit changes and open a pull request.

---

## ❓ **Support**
1. If you encounter issues, feel free to [open an issue](https://github.com/jbasalone/discord_giveaway/issues) or contact the bot admins.
2. Giveaway System was created by discord user @jennyb feel free to DM me if you have questions. 


🚀 Happy Giveaway Hosting! 🎉

