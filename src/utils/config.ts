export interface Config {
    allowedGuilds: {
        [guildId: string]: string[]; // ✅ Explicitly allow dynamic indexing
    };
}

import configData from "../config.json"; // ✅ Import config JSON

const config: Config = configData;
export default config;