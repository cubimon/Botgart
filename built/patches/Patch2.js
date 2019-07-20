"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const DBPatch_js_1 = require("./DBPatch.js");
/**
* Adds the permanent_roles table.
*/
class Patch2 extends DBPatch_js_1.DBPatch {
    constructor(db) {
        super(db);
    }
    satisfied() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.tableExists("permanent_roles");
        });
    }
    apply() {
        return __awaiter(this, void 0, void 0, function* () {
            this.dbbegin();
            this.connection.prepare(`
            CREATE TABLE IF NOT EXISTS permanent_roles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild TEXT NOT NULL,
                user TEXT NOT NULL,
                role TEXT NOT NULL,
                created TIMESTAMP DEFAULT (datetime('now','localtime')),
                UNIQUE(guild, user, role)
        )`).run();
        });
    }
    revert() {
        return __awaiter(this, void 0, void 0, function* () {
            this.dbbegin();
            this.connection.prepare(`DROP TABLE IF EXISTS permanent_roles`).run();
            this.dbcommit();
        });
    }
}
exports.Patch2 = Patch2;
