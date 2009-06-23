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
    println("ApiDB initialized");
}

function store_characters(id, chars) {
    for (i in chars) {
        ApiDB.executeSimpleSQL("replace into characters values ('"+chars[i][0]+"',"+chars[i][1]+","+acct+");");
    }
}

function load_characters(acct) {
    return acct
        ? ApiDB.doSelectQuery("select name, id from characters where account="+acct+";")
        : [];
}

function add_empty_account() {
    ApiDB.executeSimpleSQL("insert into accounts (name) values ('');");
}

function get_accounts() {
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
            println(array[1]);
            array.splice(0);
        }
    );
    return res;
}

function update_acct_name(id, name) {
    // We need some way to escape data...
    ApiDB.executeSimpleSQL("update accounts set name='"+name+"' where id="+id+";");
}

function store_keys(acct_data) {
    ApiDB.executeSimpleSQL("update accounts set acct_id='"+acct_data.acct_id+"', " +
        "ltd='"+acct_data.ltd+"', full='"+acct_data.full+"' " +
        "where id="+acct_data.id+";");
}

function request_char_list(id) {
    var data = ApiDB.doSelectQuery("select acct_id, ltd from accounts where id='"+id+"';");
    var list = EveApiService.getCharacterList(data[0], data[1]);
    if (!list)
        return;

    var result = [];
    for (var node = list.firstChild; node; node = node.nextSibling) {
        if (!node.hasAttributes())
            continue; 
        result.push([node.getAttribute('name'),
            node.getAttribute('characterID'),
            node.getAttribute('corporationID')
        ]);
    }

    store_characters(data[0], result);
    return result;
}
