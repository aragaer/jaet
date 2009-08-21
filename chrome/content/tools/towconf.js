const towerList = [];
const towerTypes = [];
const structList = [];
const towerNames = {};
var towersTree, structTree;
var towersTreeView = {
    rowCount:   0,
    getCellText: function (aRow, aCol) {
        var t = towerList[aRow];
        var tt = towerTypes[aRow];
        switch(aCol.id) {
        case 'name':    return t.name || tt.name;
        case 'grid':    return t.powerUsage + '/' + tt.powerGrid;
        case 'cpu':     return t.CPUUsage + '/' + tt.CPU;
        default:        return '';
        }
    },
    isEditable: function (row,col) { return false; },
    isContainer: function (aRow) { return false; },
    isContainerOpen: function (aRow) { return false; },
    isContainerEmpty: function (aRow) { return false ; },
    getLevel: function (aRow) { return 0; },
    getParentIndex: function (aRow) { return -1; },
    hasNextSibling: function (aRow, aAfterRow) { return 0; },
    toggleOpenState: function (aRow) { return; },
    setTree: function (treebox) { this.treebox = treebox; },
    isSeparator: function (row) { return false; },
    isSorted: function () { return false; },
    getImageSrc: function (row,col) { return null; },
    getRowProperties: function (row,props) {},
    getCellProperties: function (row,col,props) {},
    getColumnProperties: function (colid,col,props) {},
    canDrop: function (index, orientation) { return false; },
    drop: function (index, orientation) { },
};
const attlist = [];
var structTreeView = {
    rowCount:   0,
    getCellText: function (aRow, aCol) {
        switch (aCol.id) {
        case 'struct':
            return '';
        case 'tower' :
            return [structList[aRow].type.name, attlist[aRow]].join('<br />');
        default: break;
        }
    },
    isEditable: function (row,col) { return false; },
    isContainer: function (aRow) { return false; },
    isContainerOpen: function (aRow) { return false; },
    isContainerEmpty: function (aRow) { return false ; },
    getLevel: function (aRow) { return 0; },
    getParentIndex: function (aRow) { return -1; },
    hasNextSibling: function (aRow, aAfterRow) { return 0; },
    toggleOpenState: function (aRow) { return; },
    setTree: function (treebox) { this.treebox = treebox; },
    isSeparator: function (row) { return false; },
    isSorted: function () { return false; },
    getImageSrc: function (row,col) {
        if (col.id == 'struct')
            return 'chrome://jaet/content/images/'+structList[row].type.id+'.png';
    },
    getRowProperties: function (row,props) {},
    getCellProperties: function (row,col,props) {},
    getColumnProperties: function (colid,col,props) {},
    canDrop: function (index, orientation) { return false; },
};

function toOpenWindowByType(inType, uri) {
  var winopts = "chrome,extrachrome,menubar,resizable,scrollbars,status,toolbar";
  window.open(uri, "_blank", winopts);
}

function onTowersLoad() {
    towersTree = document.getElementById('towers');
    structTree = document.getElementById('structures');
}

function isSystem(loc) {
    return loc < 60000000;
}

function loadTowers() {
    var ch = document.getElementById('character');
    var chid = EveApi.getCharByName(ch.value);

    if (chid == 0) {
        alert("No character '"+ch.value+"' found");
        return;
    }

    var result = EveApi.getCorporationAssets(chid);
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
