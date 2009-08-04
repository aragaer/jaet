const towerList = [];
var towersTree;
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

function onTowerDclick(aEvt) {
    var tbo = towersTree.treeBoxObject;
    var row = { }, col = { }, child = { };

    // get the row, col and child element at the point
    tbo.getCellAt(aEvt.clientX, aEvt.clientY, row, col, child);

    if (row.value == -1)
        return;

    towersTree.startEditing(row.value, towersTree.columns.getNamedColumn('name'));
}

function onTowerSelect(aEvt) {
    var row = towersTree.currentIndex;
}

function onTowersLoad() {
    towersTree = document.getElementById('towerlist');
    towersTree.addEventListener('select', onTowerSelect, true);
    towersTree.addEventListener('dblclick', onTowerDclick, true);
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

        towerList.push(a);
    });
    
    towersTreeView.rowCount = towerList.length;
    towersTree.view = towersTreeView;
}

