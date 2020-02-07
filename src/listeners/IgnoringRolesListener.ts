const config = require("../../config.json");
import { Listener } from  "discord-akairo";
import * as L from "../Locale.js";
import * as discord from "discord.js";
import { BotgartClient } from "../BotgartClient";
import * as U from "../Util.js";

export class IgnoringRolesListener extends Listener {
    constructor() {
        super("IgnoringRolesListener", {
            emitter: "client",
            eventName: "guildMemberUpdate"
        });
    }

    exec(oldMember: discord.GuildMember, newMember: discord.GuildMember) {
        const oldRoles = oldMember.roles.map(r => r.name);
        const newRoles: discord.Role[] = newMember.roles.filter(r => !oldRoles.includes(r.name)).array();
        const ignoringRoles = newRoles.filter(r => config.achievements.ignoring_roles.includes(r.name));
        if(ignoringRoles.length > 0) {
            const client = <BotgartClient>this.client;
            const userdata = client.db.getUserByDiscordId(newMember.user);
            let deletedLeads = 0;
            let revokedAchievements = 0;
            for(const achievement of client.getAchievements()) {
                const role: discord.Role = newMember.guild.roles.find(r => r.name === achievement.getRoleName());
                if(role) {
                    newMember.removeRole(role);
                }
            }
            if(userdata) {
                [deletedLeads, revokedAchievements] = client.db.deleteAchievementInformation(userdata.gw2account);
            }
            U.log("info", "IngoringRolesListener.js", `Player ${newMember.displayName} assigned themselves an achievement ignoring role(s) ${ignoringRoles.map(r => r.name)}. Revoked ${revokedAchievements} achievements and all information about ${deletedLeads} leads from the DB.`);
        }
    }
}

module.exports = IgnoringRolesListener;