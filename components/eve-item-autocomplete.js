const Cc = Components.classes;
const Ci = Components.interfaces;

const S_CLASS_ID = Components.ID("{a3bce6bb-570f-450a-96e5-567d688bd398}");
const S_CLASS_NAME = "EVE Item Type Autocomplete";
const S_CONTRACT_ID = "@mozilla.org/autocomplete/search;1?name=item-type-autocomplete";

const R_CLASS_ID = Components.ID("{4542e5b1-a461-49b4-bd03-a631f791f704}");
const R_CLASS_NAME = "EVE Item Type Autocomplete Result";
const R_CONTRACT_ID = "@mozilla.org/autocomplete/item-type-result;1";

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

// Implements nsIAutoCompleteResult
function ItemTypeAutoCompleteResult(searchString, searchResult,
        defaultIndex, errorDescription, results) {
    this._searchString = searchString;
    this._searchResult = searchResult;
    this._defaultIndex = defaultIndex;
    this._errorDescription = errorDescription;
    if (results) {
        this._results = [i[0] for each (i in results)];
        this._comments = [i[1] for each (i in results)];
    }
}

ItemTypeAutoCompleteResult.prototype = {
    _searchString: "",
    _searchResult: 0,
    _defaultIndex: 0,
    _errorDescription: "",
    _results: [],
    _comments: [],

    classDescription: R_CLASS_NAME,
    classID:          R_CLASS_ID,
    contractID:       R_CONTRACT_ID,

    get searchString()      this._searchString,
    get searchResult()      this._searchResult,
    get defaultIndex()      this._defaultIndex,
    get errorDescription()  this._errorDescription,
    get matchCount()        this._results.length,
    getValueAt:     function (index) this._results[index],
    getCommentAt:   function (index) this._comments[index],
    getStyleAt:     function (index) null,
    getImageAt:     function (index) "",
    removeValueAt:  function (index, removeFromDb) this._results.splice(index, 1),

    QueryInterface: XPCOMUtils.generateQI([Ci.nsIAutoCompleteResult]),
};

var query;
// Implements nsIAutoCompleteSearch
function ItemTypeAutoCompleteSearch() {
    Cc["@mozilla.org/observer-service;1"].
            getService(Ci.nsIObserverService).
            addObserver(this, 'eve-db-init', false);
    this.observe('','eve-db-init',''); // Force the first init
}

ItemTypeAutoCompleteSearch.prototype = {
    classDescription: S_CLASS_NAME,
    classID:          S_CLASS_ID,
    contractID:       S_CONTRACT_ID,

    _xpcom_factory: {
        singleton: null,
        createInstance: function (aOuter, aIID) {
            if (aOuter != null)
                throw Components.results.NS_ERROR_NO_AGGREGATION;
            if (this.singleton == null)
                this.singleton = new ItemTypeAutoCompleteSearch();
            return this.singleton.QueryInterface(aIID);
        }
    },

    startSearch: function (searchString, searchParam, result, listener) {
        var sslc = searchString.toLowerCase();
        var ssl = searchString.length;
        var results = [];
        query.params.pattern = sslc+"%";
        try {
            while (query.step())
                results.push([query.row.typeName]);
        } catch (e) {
            dump("Error in item type autocomplete: "+e+"\n");
        } finally {
            query.reset();
        }
        var newResult = new ItemTypeAutoCompleteResult(searchString,
                Ci.nsIAutoCompleteResult.RESULT_SUCCESS, 0, "", results);
        listener.onSearchResult(this, newResult);
    },

    stopSearch: function () {},

    QueryInterface: XPCOMUtils.generateQI([Ci.nsIAutoCompleteSearch, Ci.nsIObserver]),
    observe:            function (aSubject, aTopic, aData) {
        switch (aTopic) {
        case 'eve-db-init':
            var dbs = Cc["@aragaer/eve/db;1"].getService(Ci.nsIEveDBService);
            var conn = dbs.getConnection();
            query = conn.createStatement("select typeName from static.invTypes " +
                    "where typeName like :pattern limit 5;");
        }
    },

};

function BuildableAutoCompleteSearch() {
    Cc["@mozilla.org/observer-service;1"].
            getService(Ci.nsIObserverService).
            addObserver(this, 'eve-db-init', false);
    this.observe('','eve-db-init',''); // Force the first init
}

BuildableAutoCompleteSearch.prototype = {
    classDescription: "Autocomplete search for items that could be manufactured",
    classID:          Components.ID("{0e3e8511-87ad-4fa7-80cf-386e014e1f8a}"),
    contractID:       "@mozilla.org/autocomplete/search;1?name=item-type-buildable-autocomplete",

    _xpcom_factory: {
        singleton: null,
        createInstance: function (aOuter, aIID) {
            if (aOuter != null)
                throw Components.results.NS_ERROR_NO_AGGREGATION;
            if (this.singleton == null)
                this.singleton = new BuildableAutoCompleteSearch();
            return this.singleton.QueryInterface(aIID);
        }
    },

    startSearch: function (searchString, searchParam, result, listener) {
        var sslc = searchString.toLowerCase();
        var ssl = searchString.length;
        var results = [];
        this.query.params.pattern = sslc+"%";
        try {
            while (this.query.step())
                results.push([this.query.row.typeName, this.query.row.typeID]);
        } catch (e) {
            dump("Error in buildable item type autocomplete: "+e+"\n");
        } finally {
            this.query.reset();
        }
        var newResult = new ItemTypeAutoCompleteResult(searchString,
                Ci.nsIAutoCompleteResult.RESULT_SUCCESS, 0, "", results);
        listener.onSearchResult(this, newResult);
    },

    stopSearch: function () {},

    QueryInterface: XPCOMUtils.generateQI([Ci.nsIAutoCompleteSearch, Ci.nsIObserver]),
    observe:            function (aSubject, aTopic, aData) {
        switch (aTopic) {
        case 'eve-db-init':
            var dbs = Cc["@aragaer/eve/db;1"].getService(Ci.nsIEveDBService);
            var conn = dbs.getConnection();
            this.query = conn.createStatement("select typeName, t.typeID from invTypes as t " +
                    "inner join invBlueprintTypes as b on t.typeID=b.productTypeID " +
                    "where typeName like :pattern limit 5;");
        }
    },

};


var components = [ItemTypeAutoCompleteResult, ItemTypeAutoCompleteSearch,
    BuildableAutoCompleteSearch];
function NSGetModule(compMgr, fileSpec) {
    return XPCOMUtils.generateModule(components);
}

