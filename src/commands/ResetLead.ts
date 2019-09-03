let config = require.main.require("../config.json");
import { Command, Listener } from "discord-akairo";
import * as Util from "../Util";
import * as Const from "../Const";
import * as L from "../Locale";
import * as discord from "discord.js";
import { BotgartClient } from "../BotgartClient";
import { BotgartCommand } from "../BotgartCommand";

/**
Testcases:

*/
export class WvWMap {
    static readonly RedBorderlands = new WvWMap("📕", "RED_BORDERLANDS");
    static readonly BlueBorderlands = new WvWMap("📘", "BLUE_BORDERLANDS");
    static readonly GreenBorderlands = new WvWMap("📗", "GREEN_BORDERLANDS");
    static readonly EternalBattlegrounds = new WvWMap("📙", "ETERNAL_BATTLEGROUNDS");

    static getMaps(): WvWMap[] {
        return [WvWMap.RedBorderlands, WvWMap.BlueBorderlands, WvWMap.GreenBorderlands, WvWMap.EternalBattlegrounds];
    }

    static getMapByEmote(emote: string): WvWMap {
        return WvWMap.getMaps().filter(m => m.emote === emote)[0] // yields undefined if no match
    }

    static getMapByName(name: string): WvWMap {
        return WvWMap.getMaps().filter(m => m.name === name)[0] // yields undefined if no match
    }

    public readonly emote: string;
    public readonly name: string;
    public readonly resetLeads: Set<string>;

    public getLocalisedName(separator = "\n", flags = true): string {
        return L.get(this.name, [], separator, flags);
    }

    private constructor(emote: string, name: string) {
        this.emote = emote;
        this.name = name;
        this.resetLeads = new Set<string>();
    }
}

export class Roster {
    public readonly leads: {[key: string] : WvWMap};
    public readonly weekNumber: number;

    public constructor(weekNumber: number) {
        this.weekNumber = weekNumber;
        this.leads = {};
        for(const m of WvWMap.getMaps()) {
            this.leads[m.name] = m;
        }
    }

    public getLeaders(): [WvWMap, string][] {
        const leaders = [];
        for(const m of WvWMap.getMaps()) {
            for(const l of this.leads[m.name].resetLeads) {
                leaders.push([m.name, l]);
            }
        }
        return leaders;
    }

    public addLead(map: WvWMap, player: string): void {
        this.leads[map.name].resetLeads.add(player);
    }

    public removeLead(map: WvWMap, player: string): void {
        if(map === undefined) {
            for(const m in this.leads) {
                this.leads[m].resetLeads.delete(player);
            }
        } else {
            this.leads[map.name].resetLeads.delete(player)    
        }
        
    }

    public toRichEmbed(): discord.RichEmbed {
        const re = new discord.RichEmbed()
            .setColor("#ff0000")
            .setAuthor("Reset Commander Roster")
            .setTitle(`${L.get("WEEK_NUMBER", [], " | ", false)} ${this.weekNumber}`)
            .setDescription(L.get("RESETLEAD_HEADER"))
        for(const mname in this.leads) {
            const m = this.leads[mname];
            re.addField("{0} {1}".formatUnicorn(m.emote, m.getLocalisedName(" | ", false)), m.resetLeads.size === 0 ? "-" : Array.from(m.resetLeads).join(", "))
              .addBlankField();
        }
        return re;
    }
}

export class ResetLeadCommand extends BotgartCommand {
    private messages: {[key: string]: Roster};

    constructor() {
        super("resetlead", {
            aliases: ["resetlead"],
            args: [
                {
                    id: "channel",
                    type: "channel"
                }, 
                {
                    id: "weekNumber",
                    type: "integer",
                    default: undefined
                }
            ],
            userPermissions: ["ADMINISTRATOR"]

        },
        false,  // available per DM
        true // cronable
        );
        this.messages = {};
    }

    desc(): string {
        return L.get("DESC_RESETLEAD");
    }

    checkArgs(args) {
        return !args || !args.channel || !(args.channel instanceof discord.TextChannel) ? L.get("HELPTEXT_RESETLEAD") : undefined;
    }    

    command(message: discord.Message, responsible: discord.User, guild: discord.Guild, args: any): void {
        const currentWeek = Util.getNumberOfWeek();
        const rosterWeek = !args.weekNumber || args.weekNumber < currentWeek ? currentWeek : args.weekNumber;

        this.getBotgartClient().db.getRosterPost(guild, rosterWeek).then(([dbRoster, dbChannel, dbMessage]) => {
            if(dbRoster === undefined) {
                // no roster for this guild+week -> create one
                const roster = new Roster(rosterWeek);
                (<discord.TextChannel>args.channel).send(roster.toRichEmbed())
                .then(async (mes: discord.Message) => {
                    const cancel = "❌"; // cross
                    const emotes = WvWMap.getMaps().map(m => m.emote);
                    emotes.push(cancel); 
                    for(const e of emotes) {
                        await mes.react(e);
                    }
                    this.getBotgartClient().db.addRosterPost(message.guild, roster, mes); // initial save

                    const col = mes.createReactionCollector(e => emotes.includes(e.emoji.name) , {});
                    col.on("collect", (r) => {
                        const m = WvWMap.getMapByEmote(r.emoji.name);
                        r.users.filter(u => u.id !== this.client.user.id).map(u => {
                            if(!m) {
                                // no map has been found -> X -> user wants to remove themselves from roster
                                roster.removeLead(undefined, u.username);
                            } else {
                                roster.addLead(m, u.username);
                            }
                            r.remove(u);
                        });
                        mes.edit(roster.toRichEmbed());
                        this.getBotgartClient().db.addRosterPost(message.guild, roster, mes); // save whenever someone reacts
                    });
                });            
            } else {
                // there is already a roster-post for this guild+week -> do nothing, log warning
                Util.log("warning", "ResetLead.js", `Tried to initialise roster-post for calendar week ${rosterWeek} for guild '${guild.name}' in channel '${args.channel.name}'. But there is already such a post in channel '${dbChannel.name}'`);
            }
        });
    }
}

module.exports = ResetLeadCommand;
exports.Roster = Roster;
module.exports.Roster = Roster;
module.exports.WvWMap = WvWMap;