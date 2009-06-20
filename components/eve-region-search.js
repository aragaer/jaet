const Cc = Components.classes;
const Ci = Components.interfaces;

const S_CLASS_ID = Components.ID("{70dd081f-cfd1-472e-86a2-5c7fd17d261a}");
const S_CLASS_NAME = "EVE Region Autocomplete";
const S_CONTRACT_ID = "@mozilla.org/autocomplete/search;1?name=region-autocomplete";

const R_CLASS_ID = Components.ID("{5b77e903-0d42-48c8-a9d5-aaeee0c75203}");
const R_CLASS_NAME = "EVE Region Autocomplete Result";
const R_CONTRACT_ID = "@mozilla.org/autocomplete/region-result;1";

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

const ALL_REGIONS = ["A821-A", "Aridia", "Black Rise", "Branch", "Cache",
    "Catch", "Cloud Ring", "Cobalt Edge", "Curse", "Deklein", "Delve",
    "Derelik", "Detorid", "Devoid", "Domain", "Esoteria", "Essence",
    "Etherium Reach", "Everyshore", "Fade", "Feythabolis", "Fountain",
    "Geminate", "Genesis", "Great Wildlands", "Heimatar", "Immensea",
    "Impass", "Insmother", "J7HZ-F", "Kador", "Khanid", "Kor-Azor",
    "Lonetrek", "Malpais", "Metropolis", "Molden Heath", "Oasa",
    "Omist", "Outer Passage", "Outer Ring", "Paragon Soul", "Period Basis",
    "Perrigen Falls", "Placid", "Providence", "Pure Blind", "Querious",
    "Scalding Pass", "Sinq Laison", "Solitude", "Stain", "Syndicate",
    "Tash-Murkon", "Tenal", "Tenerifis", "The Bleak Lands", "The Citadel",
    "The Forge", "The Kalevala Expanse", "The Spire", "Tribute", "UUA-F4",
    "Vale of the Silent", "Venal", "Verge Vendor", "Wicked Creek"
];

// Implements nsIAutoCompleteResult
function RegionAutoCompleteResult(searchString, searchResult,
        defaultIndex, errorDescription, results) {
    this._searchString = searchString;
    this._searchResult = searchResult;
    this._defaultIndex = defaultIndex;
    this._errorDescription = errorDescription;
    this._results = results;
}

RegionAutoCompleteResult.prototype = {
    _searchString: "",
    _searchResult: 0,
    _defaultIndex: 0,
    _errorDescription: "",
    _results: [],

    classDescription: R_CLASS_NAME,
    classID:          R_CLASS_ID,
    contractID:       R_CONTRACT_ID,

    get searchString() { return this._searchString; },
    get searchResult() { return this._searchResult; },
    get defaultIndex() { return this._defaultIndex; },
    get errorDescription() { return this._errorDescription; },
    get matchCount() { return this._results.length; },
    getValueAt: function (index) { return this._results[index]; },
    getCommentAt: function (index) { return ""; },
    getStyleAt: function (index) { return null },
    getImageAt : function (index) { return ""; },
    removeValueAt: function (index, removeFromDb) {
        this._results.splice(index, 1);
    },

    QueryInterface: XPCOMUtils.generateQI([Ci.nsIAutoCompleteResult]),
};

// Implements nsIAutoCompleteSearch
function RegionAutoCompleteSearch() {}

RegionAutoCompleteSearch.prototype = {
    classDescription: S_CLASS_NAME,
    classID:          S_CLASS_ID,
    contractID:       S_CONTRACT_ID,

    _xpcom_factory: {
        singleton: null,
        createInstance: function (aOuter, aIID) {
            if (aOuter != null)
                throw Components.results.NS_ERROR_NO_AGGREGATION;
            if (this.singleton == null)
                this.singleton = new RegionAutoCompleteSearch();
            return this.singleton.QueryInterface(aIID);
        }
    },

    startSearch: function (searchString, searchParam, result, listener) {
        var sslc = searchString.toLowerCase();
        var ssl = searchString.length;
        var results = ssl
            ? ALL_REGIONS.filter(function (rn) {
                    return rn.substr(0, ssl).toLowerCase() == sslc;
                })
            : ALL_REGIONS;

        var newResult = new RegionAutoCompleteResult(searchString,
                Ci.nsIAutoCompleteResult.RESULT_SUCCESS, 0, "", results);
        listener.onSearchResult(this, newResult);
    },

    stopSearch: function () {},

    QueryInterface: XPCOMUtils.generateQI([Ci.nsIAutoCompleteSearch]),
};

var components = [RegionAutoCompleteResult,RegionAutoCompleteSearch];
function NSGetModule(compMgr, fileSpec) {
    return XPCOMUtils.generateModule(components);
}
