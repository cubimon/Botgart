import { Listener } from "discord-akairo";
import { log, resolveWvWObjective, resolveWvWMap, resolveMatchColour } from "../Util";
import { BotgartClient } from "../BotgartClient";
import { MakeCron } from "../commands/cron/MakeCron";
import { get } from "../Locale";

export class Startup extends Listener {
    constructor() {
        super("ready", {
            emitter: "client",
            event: "ready"
        });
    }

    exec() {
        log("info", "Startup.js", "Bot started!");
        let cl: BotgartClient = <BotgartClient>this.client;
        cl.db.initSchema();
        log("info", "Startup.js", "Database initialised.");
        log("info", "Startup.js", "Rescheduling cronjobs from database.");
        (<MakeCron>cl.commandHandler.modules.get("makecron")).rescheduleCronjobs();
        let help = cl.commandHandler.modules.get("help").id;
        cl.user.setActivity("{0}{1} für Hilfe".formatUnicorn(cl.options.prefix, help));       
    }
}

module.exports = Startup;