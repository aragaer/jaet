// vim:syn=javascript
EXPORTED_SYMBOLS = ["EveApi"];

Components.utils.import("resource://jaet/sqlite.jsm");

const Cc = Components.classes;
const Ci = Components.interfaces;
const EveApiService = Cc['@aragaer/eve-api;1'].
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
    var static_file = Cc["@mozilla.org/file/directory_service;1"].
            getService(Ci.nsIProperties).get('CurProcD', Ci.nsIFile);
    static_file.append('jaet.db');

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
        conn.executeSimpleSQL("attach database '"+static_file.path+"' as static;");
    } catch (e) {
        dump("Failed to attach static dump database\nPlease update path in preferences.\n");
    }

    dump("ApiDB initialized\n");

    return conn;
}

function EveApiWrapper() { }

EveApiWrapper.prototype = {
    db: ApiDB,
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
        var ltd = acct_data.ltd;
        var full = acct_data.full;
        var ltd_string = 'ltd=' + (
                (ltd && ltd != '')
                    ? "'"+ltd+"'"
                    : "NULL"
                );

        var full_string = 'full=' + (
                (full && full != '')
                    ? "'"+full+"'"
                    : "NULL"
                );
        ApiDB.executeSimpleSQL("update accounts set acct_id='"+acct_data.acct_id+"', " +
            ltd_string + ', ' + full_string + " where id='"+acct_data.id+"';");
    },

    requestCharList:  function (id) {
        var data = ApiDB.doSelectQuery("select acct_id, coalesce(ltd, full) from accounts where id='"+id+"';")[0];
        var list = EveApiService.getCharacterList(data[0], data[1]);
        dump("Done requesting, there should be fresh data now\n");
        return this.loadCharacters(data[0]);
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
        var res = ApiDB.doSelectQuery("select id, name from corporations;");
        return res;
    },

    getCorporationAssets:   function (corp_id) {
        var data = ApiDB.doSelectQuery("select acct_id, full, characters.id from characters " +
                "left join accounts on account=accounts.acct_id " +
                "where characters.corporation="+corp_id+" and full is not NULL;")[0];

        if (!data[1] || !data[1].length) {
            alert("No full key provided for corporation "+corp_id);
            return;
        }
        EveApiService.updateCorporationAssets(data[0], data[1], data[2], corp_id);
        var assets = []; //EveApiService.getCorporationAssets(data[0], data[1], data[2], {});
        return assets;
    },

    updateCorporationAssets:   function (corp_id) {
        var data = ApiDB.doSelectQuery("select acct_id, full, characters.id from characters " +
                "left join accounts on account=accounts.acct_id " +
                "where characters.corporation="+corp_id+" and full is not NULL;")[0];

        if (!data[1] || !data[1].length) {
            alert("No full key provided for corporation "+corp_id);
            return;
        }
        EveApiService.updateCorporationAssets(data[0], data[1], data[2], corp_id);
    },

    getCorporationTowers: function (corp_id, system) {
        this.updateCorporationAssets(corp_id);
/*
        var assets = this.getCorporationAssets(char_id);
        return assets.filter(
            system
                ?   function (a) {
                        return a.location == system &&
                            a.type.group.id == Ci.nsEveItemGroupID.GROUP_CONTROL_TOWER;
                    }
                :   function (a) {
                        return isSystem(a.location) &&
                            a.type.group.id == Ci.nsEveItemGroupID.GROUP_CONTROL_TOWER;
                    }
            ).map(function (a) {
                return a.QueryInterface(Ci.nsIEveControlTower);
            });
*/
        return [];
    },


    _getStarbaseStm: null,
    getStarbase: function (itemID, callback) {
        this._getStarbaseStm = ApiDB.conn.createStatement(
            "select starbaseID from starbaseConfig where itemID=:item_id;"
        );
        this.getStarbase = this._getStarbase2;
        return this._getStarbase2(itemID, callback);
    },
    
    _getStarbase2:  function (itemID, callback) {
        this._getStarbaseStm.params.item_id = itemID;
        this._getStarbaseStm.executeAsync({
            empty:              true,
            handleResult:       function (aResultSet) {
                this.empty = false;
                callback(aResultSet.getNextRow().getResultByName('starbaseID'));
            },
            handleError:        ApiDB.handleError,
            handleCompletion:   function (aReason) {
                if (this.empty)
                    callback(0);
                ApiDB.handleCompletion(aReason);
            },
        });
    },

    _setStarbaseStm: null,
    setStarbase:    function (item, starbaseID) {
        this._setStarbaseStm = ApiDB.conn.createStatement(
            "replace into starbaseConfig values(:item_id, :starbase_id, 1, :item_type);"
        );
        this.setStarbase = this._setStarbase2;
        return this._setStarbase2(item, starbaseID);
    },
    _setStarbase2: function (item, starbaseID) {
        this._setStarbaseStm.params.item_id = item.id;
        this._setStarbaseStm.params.starbase_id = starbaseID;
        this._setStarbaseStm.params.item_type = item.type.id;
        this._setStarbaseStm.executeAsync(emptyAsyncHandler);
    },

    _getGridCPUReqsStm: null,
    getGridCPUReqs:     function (typeID, callback) {
        this._getGridCPUReqsStm = ApiDB.conn.createStatement(
            "select attributeID, valueInt from static.dgmTypeAttributes where " +
            "typeID=:type_id and attributeID in (30, 50);"
        );
        this.getGridCPUReqs = this._getGridCPUReqs2;
        return this._getGridCPUReqs2(typeID, callback);
    },
    _getGridCPUReqs2:   function (typeID, callback) {
        this._getGridCPUReqsStm.params.type_id = typeID;
        this._getGridCPUReqsStm.executeAsync({
            handleResult:       function (aResultSet) {
                var res = {};
                while (row = aResultSet.getNextRow())
                    res[row.getResultByIndex(0) == 30 ? 'grid' : 'cpu'] =
                            row.getResultByIndex(1);
                callback(res);
            },
            handleError:        ApiDB.handleError,
            handleCompletion:   ApiDB.handleCompletion,
        });
    },
};

const EveApi = new EveApiWrapper();

function isSystem(loc) {
    return loc < 60000000;
}

function evaluateXPath(aNode, aExpr) {
    var found = [];
    var res, result;
    var xpe = Cc["@mozilla.org/dom/xpath-evaluator;1"].
            createInstance(Ci.nsIDOMXPathEvaluator);
    var nsResolver = xpe.createNSResolver(aNode.ownerDocument == null
            ? aNode.documentElement
            : aNode.ownerDocument.documentElement);
    try {
        result = xpe.evaluate(aExpr, aNode, nsResolver, 0, null);
    } catch (e) {
        dump("error running xpe with expression '"+aExpr+"'\nCaller:"+
              evaluateXPath.caller+"\n");
        return found;
    }
    while (res = result.iterateNext())
        found.push(res);
    return found;
}

