const towerList = [];
const towerTypes = [];
var towersTree, structTree;
var towersTreeView = {
    rowCount:   0,
    getCellText: function (aRow, aCol) {
        var t = towerList[aRow];
        var tt = towerTypes[aRow];
        switch(aCol.id) {
        case 'name':    return t.name;
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
    getParentIndex: function (aRow) { return 0; },
    hasNextSibling: function (aRow, aAfterRow) { return 0; },
    toggleOpenState: function (aRow) { return; },
    setTree: function (treebox) { this.treebox = treebox; },
    isSeparator: function (row) { return false; },
    isSorted: function () { return false; },
    getImageSrc: function (row,col) { return null; },
    getRowProperties: function (row,props) {},
    getCellProperties: function (row,col,props) {},
    getColumnProperties: function (colid,col,props) {}
};

function onTowersLoad() {
    towersTree = document.getElementById('towers');
    structTree = document.getElementById('structures');
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
    result.forEach(function (a) {
        if (a.type.group.id != Ci.nsEveItemGroupID.GROUP_CONTROL_TOWER)
            return;

        towerList.push(a.QueryInterface(Ci.nsIEveControlTower));
        towerTypes.push(a.type.QueryInterface(Ci.nsIEveControlTowerType));
    });
    
    towersTreeView.rowCount = towerList.length;
    towersTree.view = towersTreeView;
}

