var config = require("../config.json");
var gw2 = require("@cthos/gw2-api");
var api = new gw2.gw2();
api.setStorage(new gw2.memStore());

exports.validateWorld = function(apikey) {
    api.setAPIKey(apikey);
    return api.getAccount().then(
       function(res) {
            return new Promise((resolve, reject) => {
                resolve(res.world === config.world_id);
            });
           
       },
       function(res) {
            return false;
       }
    );  
}
