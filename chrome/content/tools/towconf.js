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
    TowersRefresh(sysList.value, corpid);
}

function TowersRefresh(system, corpid) {
    var towlist = document.getElementById("towers");
    var structList = [];
    while (towlist.itemCount)
        towlist.removeItemAt(0);
    if (system == -1)
        return;

    EveApi.getCorporationAssets(corpid).forEach(function (a) {
        if (a.type.group.id == Ci.nsEveItemGroupID.GROUP_CONTROL_TOWER) {
            println("appending item "+a.type.name);
            var itm = towlist.appendItem(a.name || a.type.name, a.id);
            println("done, setting class");
            itm.setAttribute("class", "tower");
            println("done");
//            towerList.push(a.QueryInterface(Ci.nsIEveControlTower));
//            towerTypes.push(a.type.QueryInterface(Ci.nsIEveControlTowerType));
//            towerNames["id"+a.id] = a.name;
        } else if (isSystem(a.location)) {
            structList.push(a);
        }
    });
    if (structList.length) {
        towlist.insertItemAt(0, "Unused", 0);
    }

    if (towlist.itemCount == 0)
        towlist.appendItem("No towers found", -1);
}

function isSystem(loc) {
    return loc < 60000000;
}

function loadTowers() {
    var result = EveApi.getCorporationAssets(corpid);
    towerList.splice(0);
    towerTypes.splice(0);
    structList.splice(0);
    attlist.splice(0);
    result.forEach(function (a) {
        if (a.type.group.id == Ci.nsEveItemGroupID.GROUP_CONTROL_TOWER) {
            towerList.push(a.QueryInterface(Ci.nsIEveControlTower));
            towerTypes.push(a.type.QueryInterface(Ci.nsIEveControlTowerType));
            towerNames["id"+a.id] = a.name;
        } else if (isSystem(a.location)) {
            structList.push(a);
        }
    });

    structList.forEach(function (a) {
        var sb = EveApi.getStarbase(a.id);
        attlist.push(sb ? towerNames["id"+sb] : "");
    });
    
    towersTreeView.rowCount = towerList.length;
    structTreeView.rowCount = structList.length;
    towersTree.view = towersTreeView;
    structTree.view = structTreeView;
}

var structDragObserver = {
    draggedStructure : -1,
    onDragStart: function (aEvent, aXferData, aDragAction) {
        var row = structTree.currentIndex;
        if (row == -1)
            return;

        aXferData.data = new TransferData();
        aXferData.data.addDataForFlavour('text/unicode', structList[row].type.name);
        this.draggedStructure = row;
    },
    onDrop: function (aEvent, aXferData, aDragSession) {
        var tbo = towersTreeView.treebox;
        var row = { }, col = { }, child = { };

        // get the row, col and child element at the point
        tbo.getCellAt(aEvent.clientX, aEvent.clientY, row, col, child);
        attlist[this.draggedStructure] = towerList[row.value].name;
        EveApi.setStarbase(structList[this.draggedStructure], towerList[row.value].id);
        this.draggedStructure = -1;
        loadTowers(); // Reload the power/CPU usage values
    },
    onDragOver: function (aEvent, aFlavour, aDragSession) {
        var tbo = towersTreeView.treebox;
        var row = { }, col = { }, child = { };

        // get the row, col and child element at the point
        tbo.getCellAt(aEvent.clientX, aEvent.clientY, row, col, child);

        aDragSession.canDrop = (row.value != -1);
    },
    getSupportedFlavours: function() {
        var flavors = new FlavourSet();
        flavors.appendFlavour('text/unicode');
        return flavors;
    }
};
