const EveApiService = Cc['@aragaer.com/eve-api;1'].
        getService(Ci.nsIEveApiService);

const ApiDB = init_api_db();

function init_api_db() {
    var file = DirectoryService.get('ProfD', Ci.nsIFile);
    file.append('data');
    if (!file.exists())
        file.create(file.DIRECTORY_TYPE, 0777);

    file.append('api.db');
    if (!file.exists())
        file.create(file.NORMAL_FILE_TYPE, 0700);

    var conn = new DBH(file);

    do_check_and_create_tables(conn);
    return conn;
}

function do_check_and_create_tables(conn) {
    
}

function get_all_accounts() {
    return ApiDB.doSelectQuery("select * from accounts;");
}

function store_characters(acct, chars) {
    for (i in chars) {
        ApiDB.executeSimpleSQL("replace into characters values ('"+chars[i][0]+"',"+chars[i][1]+","+acct+");");
    }
}

function load_characters(acct) {
    return ApiDB.doSelectQuery("select name, id from characters where account="+acct+";");
}
