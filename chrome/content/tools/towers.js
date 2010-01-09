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

function convertHoursToReadable(hours) {
    var h = hours % 24;
    hours = (hours - h)/ 24;
    var d = hours % 7;
    var w = (hours - d)/7;
    var res = [];
    if (w)
        res.push(w+"w");
    if (w || d)
        res.push(d+"d");
    res.push(h+"h");
    return res.join(" ");
}

const fuelList = [];
var fuelTreeView = {
    rowCount:   0,
    getCellText: function (aRow, aCol) {
        var data = fuelList[aRow];
        switch(aCol.id) {
        case 'type':    return data.toString();
        case 'count':   return data.count;
        case 'usage':   return data.realConsumption;
        case 'time':
            var h = data.hoursLeft();
            return h == -1
                ? 'unused'
                : convertHoursToReadable(h);
        default:        return '';
        }
    },
    isEditable: function (row,col) { return false },
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
    var resources = towerList[row].getFuel({});
    fuelList.splice(0);
    for each (i in resources)
        fuelList.push(i);
    fuelTreeView.rowCount = fuelList.length;
    fuelTree.view = fuelTreeView;
}

function onTowersLoad() {
    towersTree = document.getElementById('towerlist');
    fuelTree = document.getElementById('fuels');
    towersTree.addEventListener('select', onTowerSelect, true);
    towersTree.addEventListener('dblclick', onTowerDclick, true);

    var clist = document.getElementById("corporation");
    CorpRefresh();
    setInterval(CorpRefresh, 60000);
    clist.addEventListener("command", loadTowers, true);

}
function CorpRefresh() {
    var corplist = document.getElementById("corporation");
    var idx = corplist.selectedIndex;
    corplist.removeAllItems();
    for each (let corp in EveApi.getListOfCorps())
        if (corp.id > 5000000)
            corplist.appendItem(corp.name, corp.id);
    corplist.selectedIndex = idx;
    if (idx == -1 && corplist.itemCount)
        corplist.selectedIndex = 0;
}

function loadTowers() {
    var chid = document.getElementById('corporation').value;

    towerList.splice(0);
    [towerList.push(i) for each (i in EveApi.getCorporationTowers(chid))];
    
    towersTreeView.rowCount = towerList.length;
    towersTree.view = towersTreeView;
}

