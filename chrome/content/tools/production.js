var gEIS;

function ProductionItem(type, count, cost, me) {
    this.type = gEIS.getItemType(type);
    this.count = count;
    this.cost = cost;
    this.me = me;
}

/*
const towerList = [];
var towersTree, fuelTree;
var towersTreeView = {
    get rowCount() towerList.length,
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
    isEditable: function (row,col) col.id == 'name',
    isContainer:        function (aRow) false,
    isContainerOpen:    function (aRow) false,
    isContainerEmpty:   function (aRow) false,
    getLevel:           function (aRow) 0,
    getParentIndex:     function (aRow) 0,
    hasNextSibling:     function (aRow, aAfterRow) 0,
    toggleOpenState:    function (aRow) { },
    setTree:            function (treebox) this.treebox = treebox,
    isSeparator:        function (aRow) false,
    isSorted:           function () false,
    getImageSrc:        function (row,col) null,
    getRowProperties:   function (row,props) { },
    getCellProperties:  function (row,col,props) { },
    getColumnProperties: function (colid,col,props) { }
};
*/

function productionPlannerOnLoad() {
    gEIS = Cc["@aragaer/eve/inventory;1"].getService(Ci.nsIEveInventoryService);
}

