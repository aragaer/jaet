const towerList = {};
const structList = [];

function onTowersLoad() {
    var clist = document.getElementById("corporation");
    var slist = document.getElementById("system");
    CorpRefresh();
    setInterval(CorpRefresh, 60000);
    clist.addEventListener("command", function () {
            SysRefresh(clist.value);
            TowersRefresh(slist.value, clist.value);
        }, true);
    slist.addEventListener("command", function () {
            TowersRefresh(slist.value, clist.value);
        }, true);
}

function CorpRefresh() {
    var corplist = document.getElementById("corporation");
    var idx = corplist.selectedIndex;
    corplist.removeAllItems();
    for each (let corp in EveApi.getListOfCorps())
        corplist.appendItem(corp.name, corp.id);
    if (idx == -1 && corplist.itemCount)
        idx = 0;
    corplist.selectedIndex = idx;
    SysRefresh(corplist.value);
}

const ApiDB = EveApi.db;
var sysNameStm, sysNameAsyncParam;
const sysNameQuery = "select solarSystemName from static.mapSolarSystems where solarSystemId=:loc;";
function SysRefresh(corpid) {
    var sysList = document.getElementById("system");
    var systems = {};
    var idx = sysList.selectedIndex;
    var thread = Cc["@mozilla.org/thread-manager;1"].
            getService(Ci.nsIThreadManager).currentThread;
    var threadsCount = 0;
    
    if (idx < 0)
        idx = 0;

    sysList.removeAllItems();
    if (corpid)
        for each (let {location: l} in EveApi.getCorporationTowers(corpid))
            if (l && !systems[l]++) {
                if (!sysNameStm) {
                    sysNameStm = ApiDB.conn.createStatement(sysNameQuery);
                    sysNameAsyncParam = { handleError: ApiDB.handleError }
                }
                sysNameAsyncParam.handleResult =
                        ApiDB.handleSingleScalarResult('solarSystemName',
                            function (name) { sysList.appendItem(name, l); });
                sysNameAsyncParam.handleCompletion =
                        function (aReason) { threadsCount-- };
                sysNameStm.params.loc = l;
                threadsCount++;
                sysNameStm.executeAsync(sysNameAsyncParam);
            }
    while (threadsCount)
        thread.processNextEvent(true);

    if (!sysList.itemCount)
        sysList.appendItem("-", -1);

    sysList.selectedIndex = idx;
}

function TowersRefresh(system, corpid) {
    var towlist = document.getElementById("towers");
    [delete i for each (i in towerList)];
    structList.splice(0);
    for (let i = towlist.itemCount; i--;)
        towlist.removeItemAt(0);

    EveApi.getCorporationAssets(corpid).
            filter(function (a) { return a.location == system }).
            forEach(function (a) {
        if (a.type.group.id == Ci.nsEveItemGroupID.GROUP_CONTROL_TOWER) {
            var item = document.createElement('richlistitem');
            item.setAttribute('name', a.name);
            item.className = 'tower';
            towlist.appendChild(item);
            item.tower = a.QueryInterface(Ci.nsIEveControlTower);
            towerList[a.id] = item;
        } else if (isSystem(a.location)) {
            structList.push(a);
        }
    });

    if (structList.length) {
        var item = document.createElement('richlistitem');
        item.className = 'tower';
        item.setAttribute('name', "Unused/Offline");
        item.setAttribute('value', 0);
        towlist.insertBefore(item, towlist.firstChild);
        towerList.unused = item;
    }

    for each (a in structList)
        EveApi.getStarbase(a.id, function (pos) {
            if (!pos)
                pos = 'unused';
            towerList[pos].addStructure(a);
        });

    if (towlist.itemCount == 0)
        towlist.appendItem("No towers found", -1);
}

function isSystem(loc) {
    return loc < 60000000;
}

