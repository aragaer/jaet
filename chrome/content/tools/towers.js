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

var fuelList;
var fuelTreeView = {
    get rowCount() fuelList.length,
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
    isEditable:         function (row,col) false,
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
    fuelList = towerList[row].getFuel({});
    fuelTree.view = fuelTreeView;
}

function onTowersLoad() {
    towersTree = document.getElementById('towerlist');
    fuelTree = document.getElementById('fuels');
    towersTree.addEventListener('select', onTowerSelect, true);
    towersTree.addEventListener('dblclick', onTowerDclick, true);

    var clist = document.getElementById("corporation");
    CorpRefresh();
    Cc["@mozilla.org/observer-service;1"].
        getService(Ci.nsIObserverService).
        addObserver({
            observe: function (aTopic, aSubject, aData) {
                switch (aData) {
                    case 'characters':
                        setTimeout(CorpRefresh, 1000);
                        break;
                    default:
                        break;
                }
            }
        }, 'eve-data', false)

    clist.addEventListener("command", loadTowers, true);

    var limg = document.getElementById('loading');
    limg.width = limg.height;
}

function CorpRefresh() {
    var corplist = document.getElementById("corporation");
    var idx = corplist.selectedIndex;
    corplist.removeAllItems();
    for each (let corp in EveApi.getListOfCorps())
        if (corp.getAuthToken(Ci.nsEveAuthTokenType.TYPE_DIRECTOR))
            corplist.appendItem(corp.name, corp.id);
    corplist.selectedIndex = idx;
    if (idx == -1 && corplist.itemCount)
        corplist.selectedIndex = 0;
}

function loadTowers() {
    var chid = document.getElementById('corporation').value;

    towerList.splice(0);
    towersTree.view = towersTreeView;
    var limg = document.getElementById('loading');
    dump(Date.now()+" Start\n");
    limg.src = "chrome://jaet/content/images/loading.gif";
    EveApi.getCorporationTowersAsync(chid, null, {
        onItem:         function (t) {
            dump(Date.now()+" "+t+"\n");
            towerList.push(t);
            towersTree.view = towersTreeView;
        },
        onCompletion:   function (r) {
            limg.src = '';
            dump(Date.now()+" End\n");
        },
        onError:        function (e) dump("loadTowers: "+e+"\n"),
    });
}

