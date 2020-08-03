import * as Const from "../../Const";
import * as L from "../../Locale";
import * as discord from "discord.js";
import { BotgartCommand } from "../../BotgartCommand";

/**
Testcases:

*/
export class TsGuildAdd extends BotgartCommand {
    constructor() {
        super("tsguildadd", {
            aliases: ["tsguildadd", "mkguild", "createguild"],
            quoted: true
        }
        );
    }
    
    *args(message) {
        const guildName = yield { type: (m: discord.Message, p: string) => p.split(" ")
                                                                            .map(t => t.charAt(0).toUpperCase() + t.slice(1))
                                                                            .join(" ") 
                                };
        const guildTag  = yield { type: "string" };
        const contacts  = yield { type: (m: discord.Message, p: string) => p.split(",")
                                                                            .map(s => s.trim().match(/^.+\.\d{4}$/))
                                                                            .filter(s => s !== null)
                                                                            .map(s => s[0])
                               };
        const guildTSGroup = yield { type: (m: discord.Message, p: string) => p ? p : guildTag };

        // [1] the args-method expects all arguments to be set before forwarding them to the command-method.
        // That encompasses the confirmation prompt, which yields the unwanted behaviour of issuing the 
        // mkguild command without arguments, then have the confirmation ask if it is okay to execute
        // the command with only null arguments. 
        // Instead, we want the confirmation to not pop up when no mandatory arguments are passed 
        // and have the behaviour of the other commands to display the help text. 
        // We emulate this by doing a premature check at this point and only execute the prompt function,
        // if the mandatory arguments are set.
        const present = x => x !== undefined && x !== null;
        const confirm = present(guildName) && present(guildTag) && present(contacts) 
                        ? yield { type: (m: discord.Message, p: string) => {
                                        let res = undefined;
                                        if(Const.YES.includes(p.toLowerCase())) {
                                            res = true;
                                        } else if (Const.NO.includes(p.toLowerCase())) {
                                            res = false;
                                        }
                                        return res;
                                    },
                          prompt: {
                              start: "\n" + L.get("MK_GUILD_CONFIRM", [guildName, guildTag, contacts.join(", "), guildTSGroup]),
                              timeout: "\n" + L.get("MK_EVENT_TIMEOUT")
                          }
                        }
                        : yield { type: (m: discord.Message, p: string) => undefined };

        return { guildName, guildTag, contacts, guildTSGroup, confirm };
    }

    command(message: discord.Message, responsible: discord.User, guild: discord.Guild, args: any): void {
       if(args.confirm === false) {
           message.reply(L.get("MK_GUILD_CANCELED"));
       } else if(args.confirm === true) {
           this.getBotgartClient().getTS3Connection().post("guild", 
                                                           { 
                                                             name: args.guildName, 
                                                             tag: args.guildTag, 
                                                             tsgroup: args.guildTSGroup, 
                                                             contacts: args.contacts
                                                           })
               .then(res => message.reply(L.get("HTTP_REQUEST_RETURNED", [JSON.stringify(res)])));
           message.reply(L.get("MK_GUILD_COMPLETE"));
       } else {
           // happens mainly if the args parsing was canceled,
           // see [1]
           message.reply(L.get(this.helptextKey()));
       }
    }
}

module.exports = TsGuildAdd;