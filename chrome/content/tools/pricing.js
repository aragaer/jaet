const marketLevels = [];
const marketDumpDB = init_market_dump();
const marketCacheDB = init_market_cache();
const menu = [];
var mat_tree, item, type;

const Materials = [];

const MaterialTreeView = Cc['@aragaer.com/materials-tree-view;1'].
        getService(Ci.nsITreeView);

function init_market_dump() {
    var file = DirectoryService.get('CurProcD', Ci.nsIFile);
    file.append('data');
    if (!file.exists()) {
        alert("Static dump not found, aborting");
        return -1;
    }

    file.append('full.db');
    if (!file.exists()) {
        alert("Static dump not found, aborting");
        return -1;
    }

    return new DBH(file);
}

function init_market_cache() {
    var file = DirectoryService.get('ProfD', Ci.nsIFile);
    file.append('data');
    if (!file.exists())
        file.create(file.DIRECTORY_TYPE, 0777);

    file.append('market.db');
    if (!file.exists())
        file.create(file.NORMAL_FILE_TYPE, 0700);

    return new DBH(file);
}

function get_base_market_groups() {
    return marketDumpDB.doSelectQuery("select marketGroupId, marketGroupName" +
            " from invMarketGroups where parentGroupID is NULL;").
        map(function (a) {
                return {id: a[0], name: a[1]};
        });
}

function pricingCheck() {
    mat_tree.item = item.value;
    mat_tree.view = MaterialTreeView;
}

function onMarketGroupSelect(aEvt) {
}

function switchView() {
    /* !type.checked since it will become checked now */
    mat_tree.type = type.checked ? 'manufacture' : 'reprocess';
    mat_tree.view = MaterialTreeView;
}

function pricingOnLoad() {
    println("Activating pricing tool");
    mat_tree = document.getElementById("materials");
    type = document.getElementById("type");
    item = document.getElementById("item");
    mat_tree.dataDB = marketDumpDB;
    mat_tree.priceDB = marketCacheDB;
    mat_tree.type = 'manufacture';
    mat_tree.view = MaterialTreeView;
}
