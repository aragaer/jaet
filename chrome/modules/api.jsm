// vim:syn=javascript
EXPORTED_SYMBOLS = ["EveApi"];

Components.utils.import("resource://jaet/sqlite.jsm");

const Cc = Components.classes;
const Ci = Components.interfaces;
const EveApiService = Cc['@aragaer/eve-api;1'].
        getService(Ci.nsIEveApiService);
const EveHRManager = Cc['@aragaer/eve-hr-manager;1'].
        getService(Ci.nsIEveHRManager);
const EveInventoryService = Cc['@aragaer/eve/inventory;1'].
        getService(Ci.nsIEveInventoryService);
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

    getAccounts:       function () {
        var gAM = Cc["@aragaer/eve/auth-manager;1"].getService(Ci.nsIEveAuthManager);
        var res = gAM.getAccounts({});
        return res;
    },

    getCharByName:       function (name) {
        return ApiDB.doSelectQuery("select id from characters where name='"+name+"';");
    },

    getCorpByName:       function (name) {
        return ApiDB.doSelectQuery("select id from corporations where name='"+name+"';");
    },

    getCharacterAssets:   function (char_id) {
        var ch = EveHRManager.getCharacter(char_id);
        if (!ch)
            return;
        return ch.getAssets({});
    },

    getListOfCorps:         function () EveHRManager.getAllCorporations({}),

    getCorporationAssets:   function (corp_id) {
        var corp = EveHRManager.getCorporation(corp_id);
        if (!corp)
            return;
        return corp.getAssets({});
    },

    getCorporationAssetsAsync:   function (corp_id, handler) {
        var corp = EveHRManager.getCorporation(corp_id);
        if (!corp)
            return;
        corp.getAssetsAsync(handler);
    },

    getCorporationTowersAsync: function (corp_id, system, handler) {
        var corp = EveHRManager.getCorporation(corp_id);
        if (!corp)
            return;
        var assets = corp.getControlTowersAsync({
            onItem: system
                ?   function (a) {
                        if (a.location == system)
                            handler.onItem(a.QueryInterface(Ci.nsIEveControlTower));
                    }
                :   function (a) handler.onItem(a.QueryInterface(Ci.nsIEveControlTower)),
            onError:        handler.onError,
            onCompletion:   handler.onCompletion,
        });
    },

    getCorporationStructuresAsync: function (corp_id, handler) {
        var corp = EveHRManager.getCorporation(corp_id);
        if (!corp)
            return;
        var assets = corp.getStructuresAsync(handler);
    },

    getCorporationTowers: function (corp_id, system) {
        var corp = EveHRManager.getCorporation(corp_id);
        if (!corp)
            return;
        var assets = corp.getAssets({});
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
            ).map(function (a) { return a.QueryInterface(Ci.nsIEveControlTower) });
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

