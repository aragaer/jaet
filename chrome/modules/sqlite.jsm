let EXPORTED_SYMBOLS = ["DBH"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const StorageService = Cc["@mozilla.org/storage/service;1"].
        getService(Ci.mozIStorageService);


function DBH(db_file) {
    this.conn = StorageService.openDatabase(db_file);
    this.conn.executeSimpleSQL("PRAGMA synchronous = OFF");
    this.conn.executeSimpleSQL("PRAGMA temp_store = MEMORY");
}

DBH.prototype = {
    executeSimpleSQL: function (query) {
        dump("Executing "+query+"\n");
        this.conn.executeSimpleSQL(query);
    },

    doSelectQuery: function (query, recHandler) {
        var rv = new Array;
        dump("Executing "+query+"\n");
        var statement = this.conn.createStatement(query);
        while (statement.executeStep()) {
            var c;
            var thisArray = [];
            for (c = 0; c < statement.numEntries; c++)
                thisArray.push(statement.getString(c));
            if (recHandler)
                recHandler(thisArray);
            if (thisArray.length)
                rv.push(thisArray);
        }
        statement.reset();
        return rv;
    }
};

