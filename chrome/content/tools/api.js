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

    var conn = init_db(file);

    do_check_and_create_tables(conn);
    return conn;
}

function do_check_and_create_tables(conn) {
    
}
