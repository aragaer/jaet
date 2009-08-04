const towerList = [];
var towersTreeView = {
    rowCount:   0,
    getCellText: function (aRow, aCol) {
        var data = towerList[aRow]; 
        switch(aCol.id) {
        case 'name':    return "Name!!";
        case 'type':    return data.toString();
        case 'system':  return data.locationString();
        default:        return '';
        }
    },
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

var towersTree;

function onTowersLoad() {
    towersTree = document.getElementById('towerlist');
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

