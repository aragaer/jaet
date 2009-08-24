EXPORTED_SYMBOLS = ["EveApi"];

Components.utils.import("resource://jaet/sqlite.jsm");

const Cc = Components.classes;
const Ci = Components.interfaces;
const EveApiService = Cc['@aragaer.com/eve-api;1'].
        getService(Ci.nsIEveApiService);
const ApiDB = init_api_db();

function init_api_db() {
    var file = Cc["@mozilla.org/file/directory_service;1"].
            getService(Ci.nsIProperties).get('ProfD', Ci.nsIFile);
    file.append('data');
    if (!file.exists())
        file.create(file.DIRECTORY_TYPE, 0777);

    file.append('api.db');
    if (!file.exists())
        file.create(file.NORMAL_FILE_TYPE, 0700);

    var conn = new DBH(file);
    var static = Cc["@mozilla.org/preferences-service;1"].
            getService(Ci.nsIPrefBranch).getCharPref("eve.static_dump_path");

    try {
        conn.doSelectQuery("select 1 from accounts;");
    } catch (e) {
        conn.executeSimpleSQL("CREATE TABLE accounts " +
            "(name char, id integer, acct_id integer, ltd char, full char, primary key (id));");
    }
    try {
        conn.doSelectQuery("select 1 from characters;");
    } catch (e) {
        conn.executeSimpleSQL("CREATE TABLE characters " +
            "(name char, id integer, account integer, corporation integer, primary key (id));");
    }
    try {
        conn.doSelectQuery("select 1 from corporations;");
    } catch (e) {
        conn.executeSimpleSQL("CREATE TABLE corporations " +
            "(name char, ticker char, id integer, alliance integer, primary key (id));");
    }
    try {
        conn.doSelectQuery("select 1 from assets;");
    } catch (e) {
        conn.executeSimpleSQL("CREATE TABLE assets " +
            "(id integer, char integer, location integer, type integer, " +
            "quantity integer, flag integer, singleton integer, primary key (id));");
    }

    try {
        conn.executeSimpleSQL("attach database '"+static+"' as static;");
    } catch (e) {
        alert("Failed to attach static dump database\nPlease update path in preferences.\n");
    }

    dump("ApiDB initialized\n");

    return conn;
}

function EveApiWrapper() { }

EveApiWrapper.prototype = {
    loadCharacters:    function (acct) {
        return acct
            ? ApiDB.doSelectQuery("select name, id from characters where account='"+acct+"';")
            : [];
    },

    addEmptyAccount:  function () {
        ApiDB.executeSimpleSQL("insert into accounts (name) values ('');");
    },

    getAccounts:       function () {
        var res = [];
        ApiDB.doSelectQuery("select name, id, acct_id, ltd, full from accounts;",
            function (array) {
                res.push({
                    name: array[0],
                    id  : array[1],
                    acct_id: array[2],
                    ltd : array[3],
                    full: array[4]
                });
                array.splice(0);
            }
        );
        return res;
    },

    updateAcctName:   function (id, name) {
        // We need some way to escape data...
        ApiDB.executeSimpleSQL("update accounts set name='"+name+"' where id='"+id+"';");
    },

    storeKeys:         function (acct_data) {
        ApiDB.executeSimpleSQL("update accounts set acct_id='"+acct_data.acct_id+"', " +
            "ltd='"+acct_data.ltd+"', full='"+acct_data.full+"' " +
            "where id='"+acct_data.id+"';");
    },

    requestCharList:  function (id) {
        var data = ApiDB.doSelectQuery("select acct_id, ltd from accounts where id='"+id+"';")[0];
        var list = EveApiService.getCharacterList(data[0], data[1]);
        if (!list)
            return;

        var result = [];
        for (var node = list.firstChild; node; node = node.nextSibling) {
            if (!node.hasAttributes())
                continue;
            var res = [node.getAttribute('name'),
                node.getAttribute('characterID'),
                node.getAttribute('corporationID')
            ];
            result.push(res);
            ApiDB.executeSimpleSQL("replace into characters (name, id, account, corporation) " +
                "values ('"+res[0]+"',"+res[1]+", "+data[0]+","+res[2]+");");
        }
        return result;
    },

    deleteAccount:         function (id) {
        var acct_id = ApiDB.doSelectQuery("select acct_id from accounts where id='"+id+"';");
        ApiDB.executeSimpleSQL("delete from characters where account='"+acct_id+"';");
        ApiDB.executeSimpleSQL("delete from accounts where id='"+id+"';");
    },

    getCharByName:       function (name) {
        return ApiDB.doSelectQuery("select id from characters where name='"+name+"';");
    },

    getCorpByName:       function (name) {
        return ApiDB.doSelectQuery("select id from corporations where name='"+name+"';");
    },

    getCharacterAssets:   function (char_id) {
        var data = ApiDB.doSelectQuery("select acct_id, full from characters " +
                "left join accounts on account=accounts.acct_id " +
                "where characters.id="+char_id+";")[0];

        if (!data[1] || !data[1].length) {
            alert("No full key provided for character "+char_id);
            return;
        }
        var assets = EveApiService.getCharacterAssets(data[0], data[1], char_id, {});
        return assets;

    },

    getListOfCorps:         function () {
        return ApiDB.doSelectQuery("select id, name from corporations;");
    },

    getCorporationAssets:   function (corp_id) {
        var data = ApiDB.doSelectQuery("select acct_id, full, characters.id from characters " +
                "left join accounts on account=accounts.acct_id " +
                "where characters.corporation="+corp_id+" and full is not NULL;")[0];

        if (!data[1] || !data[1].length) {
            alert("No full key provided for corporation "+corp_id);
            return;
        }
        var assets = EveApiService.getCorporationAssets(data[0], data[1], data[2], {});
        return assets;
    },

    getCorporationTowers: function (char_id) {
        var assets = this.getCorporationAssets(char_id);
        var result = assets.filter()
    },

    getStarbase: function (itemID) {
        var data = ApiDB.doSelectQuery("select starbaseID " +
            "from starbaseConfig where itemID='"+itemID+"';");

        return +data[0];
    },

    setStarbase: function (item, starbaseID) {
        ApiDB.executeSimpleSQL("replace into starbaseConfig values(" +
            [item.id, starbaseID, 1, item.type.id].join(',')+");");
    },
};

const EveApi = new EveApiWrapper();

