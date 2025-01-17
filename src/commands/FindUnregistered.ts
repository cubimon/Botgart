import * as discord from "discord.js";
import { Util } from "discord.js";
import { BotgartClient } from "../BotgartClient";
import { BotgartCommand } from "../BotgartCommand";
import { getConfig } from "../config/Config";

export class FindUnregistered extends BotgartCommand {
    constructor() {
        super("findunregistered", {
                aliases: ["findunreg"],
            }
        );
    }

    async command(message: discord.Message, responsible: discord.User, guild: discord.Guild, args) {
        const cl: BotgartClient = this.getBotgartClient();
        const registrations = cl.registrationRepository.loadUserIds(guild.id);

        const worldRoleNames = getConfig().get().world_assignments.map(val => val.role);

        guild.members.fetch()
            .then(async members => members
                .filter(member => !member.user.bot)
                .filter(member => !registrations.includes(member.user.id))
                .filter(member => member.roles.cache.find(role => worldRoleNames.includes(role.name)) !== undefined)
                .sort())
            .then(async value => {
                const result = `Found ${value.size}:\n` + value.map(value1 => value1.toString()).join("\n");

                for (const split of Util.splitMessage(result)) {
                    await message.channel.send(split);
                }
            });
    }
}

module.exports = FindUnregistered;