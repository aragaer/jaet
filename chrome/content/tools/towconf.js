const towerList = [];
const towerTypes = [];
const structList = [];
const towerNames = {};

function toOpenWindowByType(inType, uri) {
  var winopts = "chrome,extrachrome,menubar,resizable,scrollbars,status,toolbar";
  window.open(uri, "_blank", winopts);
}

function onTowersLoad() {
    var clist = document.getElementById("corporation");
    var slist = document.getElementById("system");
    CorpRefresh();
    setInterval(CorpRefresh, 60000);
    clist.addEventListener("command", function () {
            println("Corp changed to "+clist.label);
            SysRefresh(clist.value);
            TowersRefresh(slist.value, clist.value);
        }, true);
    slist.addEventListener("command", function () {
            println("System changed to "+clist.label);
            TowersRefresh(slist.value, clist.value);
        }, true);
}

function CorpRefresh() {
    var corplist = document.getElementById("corporation");
    var idx = corplist.selectedIndex;
    corplist.removeAllItems();
    EveApi.getListOfCorps().forEach(function (a) {
        corplist.appendItem(a[1], a[0]);
    });
    if (idx == -1 && corplist.itemCount)
        idx = 0;
    corplist.selectedIndex = idx;
    SysRefresh(corplist.value);
}

function SysRefresh(corpid) {
    var sysList = document.getElementById("system");
    var systems = {}
    if (corpid) {
        EveApi.getCorporationTowers(corpid).forEach(function (a) {
            systems[a.location] = 1;
        });
    }
    delete(systems[0]);
    var idx = sysList.selectedIndex;
    if (idx < 0)
        idx = 0;
    sysList.removeAllItems();
    for (sys in systems) {
        var name = EveApi.db.doSelectQuery("select solarSystemName from static.mapSolarSystems where solarSystemId="+sys+";");
        sysList.appendItem(name, sys);
    }
    if (!sysList.itemCount) {
        sysList.appendItem("-", -1);
    }

    sysList.selectedIndex = idx;
}

function TowersRefresh(system, corpid) {
    var towlist = document.getElementById("towers");
    towerList.splice(0);
    structList.splice(0);
    var structsPerItm = {};
    while (towlist.itemCount)
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
            towerList.push(item);
        } else if (isSystem(a.location)) {
            var pos = EveApi.getStarbase(a.id);
            structList.push(a);
            if (!pos)
                pos = 'unused';
            if (!structsPerItm[pos])
                structsPerItm[pos] = [];
            structsPerItm[pos].push(a);
        }
    });

    if (towlist.itemCount == 0)
        towlist.appendItem("No towers found", -1);

    towerList.forEach(function (t) {
        t.structures = structsPerItm[t.id];
    });

    if (structList.length) {
        var item = document.createElement('richlistitem');
        item.className = 'tower';
        item.setAttribute('name', "Unused/Offline");
        item.setAttribute('value', 0);
        towlist.insertBefore(item, towlist.firstChild);
        item.structures = structsPerItm.unused || [];
    }
}

function isSystem(loc) {
    return loc < 60000000;
}

