import * as discord from "discord.js";
import * as http from "http";
import * as moment from "moment";
import { Registration } from "./repositories/RegistrationRepository";
import { logger } from "./util/Logging";

const LOG = logger();


export interface TS3Commander {
    readonly account_name: string;
    readonly ts_cluid: string;
    readonly ts_display_name: string;
    readonly ts_channel_name: string;
    readonly ts_channel_path: string[];
    readonly ts_join_url: string;
    readonly leadtype?: LeadType;
}

interface HTTPRequestOptions {
    readonly hostname?: string;
    readonly port?: number;
    readonly path?: string;
    readonly method?: "GET" | "POST" | "PUT" | "DELETE";
    readonly headers?: {
        "Content-Type": "application/json";
        "Content-Length": number;
    };
}

export class TS3Connection {
    private static CONNECTION_COUNTER = 1;

    private host: string;
    private port: number;
    private name: string;

    private async request(data: unknown, options: HTTPRequestOptions): Promise<string> {
        const dataString: string = JSON.stringify(data);
        const defaults: HTTPRequestOptions = {
            hostname: this.host,
            port: this.port,
            path: "/",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(dataString)
            }
        };
        const settings: HTTPRequestOptions = options === undefined ? defaults : ({ ...defaults, ...options });
        return new Promise<string>((resolve, reject) => {
            const req = http.request(settings, (response) => {
                let body = "";
                response.on("data", (chunk) => body += chunk);
                response.on("end", () => resolve(body));
            });
            req.on("error", reject);
            req.write(dataString);
            req.end();
        });
    }

    public async get(command: string, args: unknown = {}): Promise<string> {
        return this.request(args, {
            path: command,
            method: "GET"
        });
    }

    public async post(command: string, args: unknown = {}): Promise<string> {
        return this.request(args, {
            path: command,
            method: "POST"
        });
    }

    public async delete(command: string, args: unknown = {}): Promise<string> {
        return this.request(args, {
            path: command,
            method: "DELETE"
        });
    }

    public constructor(ts3host: string, ts3port: number, name?: string) {
        this.host = ts3host;
        this.port = ts3port;
        this.name = name !== undefined ? name : `TS3Connection[${TS3Connection.CONNECTION_COUNTER++}]`;
    }
}

/*
*********************************************************************************
                 tag up
    +---------------------------------+
    |                                 v
+---+---+   +--------+  delay     +---+--+
|unknown|   |COOLDOWN+----------->+TAG_UP|
+-------+   +-----+--+            +---+--+
                  ^                   | grace period
           tag up |                   v
            +-----+--+            +---+-----+
            |TAG_DOWN+<-----------+COMMANDER|
            +--------+  tag down  +---------+


Note that there is also an uncovered case:
the transition from anywhere to TAG_DOWN only happens, if
the user tags down when they are already in COMMANDER state.
That means having a user tag down while in COOLDOWN or TAG_UP
places them in a bit of a limbo state, resulting in them staying on
the exact state where they have left off. This is not an actial problem.
The "worst case" here could be the following:

imagine the delay being set to 30 minutes.
Now, an active player P commands for a while,
tags down and up again, playing P in COOLDOWN.
They then tag down immediately and play tagless for two hours.
Then, they decide to tag up again, resuming in COOLDOWN.
But since their last known timestep is two hours old, they will leave that
state immediately on the next tag to become TAG_UP.
*********************************************************************************
*/
export enum CommanderState {
    COOLDOWN,
    TAG_UP,
    COMMANDER,
    TAG_DOWN
}

export type LeadType = "UNKNOWN" | "PPT" | "PPK";

export class Commander {
    private accountName: string;
    private ts3DisplayName: string;
    private ts3clientUID: string;
    private ts3channel: string;
    private ts3channelPath: string[];
    private ts3joinUrl: string;
    private raidStart?: moment.Moment;
    private raidEnd?: moment.Moment;
    private lastUpdate: moment.Moment;
    private state: CommanderState;
    private discordMember: discord.GuildMember;
    private broadcastMessage: discord.Message | undefined;
    private currentLeadType: LeadType;
    private registration: Registration | undefined;

    public getAccountName(): string {
        return this.accountName;
    }

    public getTS3ClientUID(): string {
        return this.ts3clientUID;
    }

    public getTS3DisplayName(): string {
        return this.ts3DisplayName;
    }

    public setTS3DisplayName(name: string) {
        this.ts3DisplayName = name;
    }

    public getTS3Channel(): string {
        return this.ts3channel;
    }

    public setTS3Channel(ts3channel: string) {
        this.ts3channel = ts3channel;
    }

    public getTs3channelPath(): string[] {
        return this.ts3channelPath;
    }

    public setTs3channelPath(value: string[]) {
        this.ts3channelPath = value;
    }

    public getTs3joinUrl(): string {
        return this.ts3joinUrl;
    }

    public setTs3joinUrl(value: string) {
        this.ts3joinUrl = value;
    }

    public getRaidStart(): moment.Moment | undefined {
        return this.raidStart;
    }

    public setRaidStart(timestamp: moment.Moment) {
        this.raidStart = timestamp;
    }

    public getRaidEnd(): moment.Moment | undefined {
        return this.raidEnd;
    }

    public setRaidEnd(timestamp: moment.Moment) {
        this.raidEnd = timestamp;
    }

    public getLastUpdate(): moment.Moment {
        return this.lastUpdate;
    }

    public setLastUpdate(timestamp: moment.Moment) {
        this.lastUpdate = timestamp;
    }

    public getState(): CommanderState {
        return this.state;
    }

    public setState(state: CommanderState) {
        this.state = state;
    }

    public getDiscordMember(): discord.GuildMember | undefined {
        return this.discordMember;
    }

    public setDiscordMember(dmember: discord.GuildMember) {
        this.discordMember = dmember;
    }

    public getBroadcastMessage(): discord.Message | undefined {
        return this.broadcastMessage;
    }

    public setBroadcastMessage(msg: discord.Message | undefined) {
        this.broadcastMessage = msg;
    }


    public getCurrentLeadType(): "UNKNOWN" | "PPT" | "PPK" {
        return this.currentLeadType;
    }

    public setCurrentLeadType(value: "UNKNOWN" | "PPT" | "PPK") {
        this.currentLeadType = value;
    }

    /**
     * returns: the time of the _ongoing_ raid in seconds. If no raid is going on, 0 is returned.
     *          That means: when this method is called, it assumes the raid is still going on!
     */
    public getRaidTime(): number {
        // this cast is save, since we checked beforehand in the condition of the ternary...
        return this.getRaidStart() !== undefined ? (moment.utc().valueOf() - (this.getRaidStart() as moment.Moment).valueOf()) / 1000 : 0;
    }

    public constructor(accountName: string, ts3DisplayName: string, ts3clientUID: string, ts3channel: string, ts3channelPath: string[], ts3joinUrl: string) {
        this.accountName = accountName;
        this.ts3DisplayName = ts3DisplayName;
        this.ts3clientUID = ts3clientUID;
        this.ts3channel = ts3channel;
        this.ts3channelPath = ts3channelPath;
        this.ts3joinUrl = ts3joinUrl;
        this.lastUpdate = moment.utc();
        this.raidStart = undefined;
        this.state = CommanderState.TAG_UP;
    }

    public getRegistration(): Registration | undefined {
        return this.registration;
    }

    public setRegistration(registraton: Registration | undefined) {
        this.registration = registraton;
    }
}

export class CommanderStorage {
    private commanders: Commander[];

    public constructor() {
        this.commanders = [];
    }

    public getAllCommanders(): Commander[] {
        return this.commanders;
    }

    public getActiveCommanders(): Commander[] {
        return this.commanders.filter(c => c.getState() === CommanderState.COMMANDER);
    }

    public getCommanderByTS3UID(ts3uid: string) {
        return this.commanders.find(c => c.getTS3ClientUID() === ts3uid);
    }

    public addCommander(commander: Commander) {
        if (this.getCommanderByTS3UID(commander.getTS3ClientUID()) === undefined) {
            this.commanders.push(commander);
        } else {
            LOG.warn(
                `Tried to add commander to the cache whose TS3UID ${commander.getTS3ClientUID()} was already present. The old object was retained and no update was done!`);
        }
    }

    public deleteCommander(commander: Commander) {
        for (let i = 0; i < this.commanders.length; i++) {
            if (this.commanders[i].getTS3ClientUID() === commander.getTS3ClientUID()) {
                this.commanders.splice(i--, 1);
            }
        }
    }

    public setMinus(stillUp: Set<string>): Commander[] {
        LOG.debug(`Calling setMinus on current commanders ${this.commanders.map(c => c.getTS3ClientUID())}`);
        return this.commanders.filter(c => !stillUp.has(c.getTS3ClientUID()));
    }
}