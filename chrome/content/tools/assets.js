const my_assets = [];
var assetsTreeView = {
    rowCount : 10000,
    getCellText : function (row,column) {
        var data = my_assets[row];
        switch(column.id) {
        case 'item':    return data.toString();
        case 'loc':     return data.locationString();
        case 'cont':    return data.containerString();
        case 'count':   return data.quantity;
        default:        return '';
        }
    },
    setTree: function (treebox) { this.treebox = treebox; },
    isContainer: function (row) { return false; },
    isSeparator: function (row) { return false; },
    isSorted: function () { return false; },
    getLevel: function (row) { return 0; },
    getImageSrc: function (row,col) { return null; },
    getRowProperties: function (row,props) {},
    getCellProperties: function (row,col,props) {},
    getColumnProperties: function (colid,col,props) {}
};

function loadAssets() {
    var ch = document.getElementById('character');
    var chid = EveApi.getCharByName(ch.value);

    if (chid == 0) {
        alert("No character '"+ch.value+"' found");
        return;
    }

    var result = EveApi.getCharacterAssets(chid);

    my_assets.splice(0);

    result.forEach(function (a) {
        my_assets.push(a);
    });
    assetsTreeView.rowCount = my_assets.length;
    document.getElementById('assets').view = assetsTreeView;
}

