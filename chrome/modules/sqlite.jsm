const DirectoryService = Cc["@mozilla.org/file/directory_service;1"].
        getService(Ci.nsIProperties);
const StorageService = Cc["@mozilla.org/storage/service;1"].
        getService(Ci.mozIStorageService);


function DBH(db_file) {
    this.conn = StorageService.openDatabase(db_file);
    this.conn.executeSimpleSQL("PRAGMA synchronous = OFF");
    this.conn.executeSimpleSQL("PRAGMA temp_store = MEMORY");
}

DBH.prototype.executeSimpleSQL = function (query) {
    println("Executing "+query);
    this.conn.executeSimpleSQL(query);
}

DBH.prototype.doSelectQuery = function (query, recHandler) {
    var rv = new Array;
    println("Executing "+query);
    var statement = this.conn.createStatement(query);
    while (statement.executeStep()) {
        var c;
        var thisArray = new Array;
        for (c = 0; c < statement.numEntries; c++) {
            thisArray.push(statement.getString(c));
        }
/*        print("Result:");
        for (i in thisArray) {
            print(thisArray[i]+"\t");
        }
        print("\n");*/
        if (recHandler) {
            recHandler(thisArray);
        }
/*        print("Processed:");
        for (i in thisArray) {
            print(thisArray[i]+"\t");
        }
        print("\n");*/
        if (thisArray.length)
            rv.push(thisArray);
    }
    statement.reset();
    return rv;
}

