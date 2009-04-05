const DirectoryService = Cc["@mozilla.org/file/directory_service;1"].
        getService(Ci.nsIProperties);
const StorageService = Cc["@mozilla.org/storage/service;1"].
        getService(Ci.mozIStorageService);


function init_db(db_file) {
    var conn = StorageService.openDatabase(db_file);
    conn.executeSimpleSQL("PRAGMA synchronous = OFF");
    conn.executeSimpleSQL("PRAGMA temp_store = MEMORY");
    return conn;
}

function doSelectQuery(conn, query, recHandler) {
    var rv = new Array;
    println("Executing "+query);
    var statement = conn.createStatement(query);
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

