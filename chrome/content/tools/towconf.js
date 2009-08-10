const towerList = [];
var towersTree, fuelTree;
var towersTreeView = {
    rowCount:   0,
    getCellText: function (aRow, aCol) {
        var data = towerList[aRow];
        switch(aCol.id) {
        case 'name':    return data.name || 'Enter name...';
        case 'type':    return data.toString();
        case 'system':  return data.locationString();
        default:        return '';
        }
    },
    setCellText: function (row, col, value) {
        if (col.id != 'name')
            return;
        towerList[row].name = value;
    },
    isEditable: function (row,col) { return col.id == 'name'; },
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
    result.forEach(function (a) {
        if (a.type.group.id != Ci.nsEveItemGroupID.GROUP_CONTROL_TOWER)
            return;

        towerList.push(a.QueryInterface(Ci.nsIEveControlTower));
    });
    
    towersTreeView.rowCount = towerList.length;
    towersTree.view = towersTreeView;
}

