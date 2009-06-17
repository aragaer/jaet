const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
var exportsDirectory;

function EveMarketExportService() { }

EveMarketExportService.prototype = {
    classDescription: "EVE Market Exports Service",
    classID:          Components.ID("{787242ef-1931-4c67-89c1-e3e534581153}"),
    contractID:       "@aragaer.com/eve-market-exports;1",
    QueryInterface: XPCOMUtils.generateQI([Ci.nsIEveMarketExportService]),
    _xpcom_categories: [{
        category: "xpcom-startup",
        service: true
    }],

    initWithPath:    function (path) {
        exportsDirectory = Cc["@mozilla.org/file/local;1"].
            createInstance(Ci.nsILocalFile).
            initWithPath(path);
    },
    
    getExports: function () {
        var res = [];
        var entries = exportsDirectory.directoryEntries;
        while (entries.hasMoreElements())
            res.push(EveMarketExport(entries.
                    getNext().QueryInterface(Ci.nsIFile)));
        return res;
    },

    getExportsByRegion: function (regName) {
        return this.getExports().filter(filterByReg(regName));
    }
};

function filterByReg(regName) {
    return function (el) {
        return el.region == regName;
    }
}

function EveMarketExport(aFile) {
    this.file = aFile;
    var record = aFile.leafName.split(/\b-\b/);
    this.region = record[0];
    this.item = record[1];
    
    var dateparts = record[2].split(/\.| /);
    dateparts.pop(); // 'txt'
    var times = [+dateparts[3].substr(0,2),
            +dateparts[3].substr(2,2),
            +dateparts[3].substr(4,2)];
    this.date = new Date(dateparts[0], dateparts[1], dateparts[2],
            times[0], times[1], times[2]);
}

EveMarketExport.prototype = {
    classDescription: "EVE Market Export",
    classID:          Components.ID("{143c265f-0599-4f50-ac7c-6085c4741c91}"),
    contractID:       "@aragaer.com/eve-market-export;1",
    QueryInterface: XPCOMUtils.generateQI([Ci.nsIEveMarketExport])
};

var components = [EveMarketExportService, EveMarketExport];
function NSGetModule(compMgr, fileSpec) {
    return XPCOMUtils.generateModule(components);
}
