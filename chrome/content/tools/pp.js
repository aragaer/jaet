var gEIS, gDB;
const Queries = {
    getTypeByName:  "select typeID from invTypes where typeName=:tn",
    getBPByType:    "select blueprintTypeID, wasteFactor from invBlueprintTypes where productTypeID=:tid",
    getRawMats:     "select materialTypeID as tid, quantity from invTypeMaterials where typeID=:tid",
    getExtraMats:   "select requiredTypeID as tid, quantity, damagePerJob from ramTypeRequirements " +
            "where typeID=:bpid;",
};
const Stms = { };

const AllItemTypes = {};
const AllItems = {};
const AllBlueprints = {};

const ActionLog = [];
function LOG(text) {
    ActionLog.push(text);
    dump(text+"\n");
}

function ItemType(typeID) {
    this.id = typeID;
    this._type = null;
    this._bp = null;
    this._uses = null;
}

function getItemTypeByID(typeID) {
    if (!AllItemTypes[typeID])
        AllItemTypes[typeID] = new ItemType(typeID);
    return AllItemTypes[typeID];
}

ItemType.prototype = {
    get type() {
        this.__defineGetter__('type', function () this._type);
        this._type = gEIS.getItemType(this.id);
        return this._type;
    },
    get bp()    this._getBPAndWaste('_bp'),
    get waste() this._getBPAndWaste('_waste'),

    _getBPAndWaste: function (arg) {
        this.__defineGetter__('bp', function () this._bp);
        this.__defineGetter__('waste', function () this._waste);
        let stm = Stms.getBPByType;
        try {
            stm.params.tid = this.id;
            if (!stm.step())
                return;
            this._bp = stm.row.blueprintTypeID;
            this._waste = stm.row.wasteFactor;
        } catch (e) {
            dump("Production planner: getBPByType for "+this.id+": "+e+"\n");
        } finally { stm.reset(); }
        return this[arg];
    },
    get raw()   {
        this.__defineGetter__('uses', function () this._uses);
        this._raw = {};
        let stm = Stms.getRawMats;
        try {
            stm.params.tid = this.id;
            while (stm.step())
                this._raw[stm.row.tid] = stm.row.quantity;
        } catch (e) {
            dump("Filling 'uses' for "+this.type.name+": "+e+"\n");
        } finally { stm.reset(); }
        return this._raw;
    },
};
function Item(typeID, quantity) {
    this.type = typeID;
    this.quantity = quantity;
}
function Blueprint(typeID, productTypeID, me, runs) {
    this.type = typeID;
    this.product = productTypeID;
    this.me = me;
    this.runs = runs;
}

function getBPMEList(productTypeID) {
    if (!AllBlueprints[productTypeID])
        AllBlueprints[productTypeID] = [];
    for each (bp in AllBlueprints[productTypeID].sort(function (a, b) b.me - a.me))
        for (var cnt = 0; cnt < bp.runs; cnt++)
            yield {me: bp.me};
    while (true)
        yield {me: 0, fake: true};
}

const showHide = {
    order:      function (aEvt) 
        document.getElementById('btn-remove').hidden =
                (getListByName('order').getRowAt(aEvt.clientX, aEvt.clientY) == -1),
    build:      function (aEvt) {
        if (getListByName('build').getRowAt(aEvt.clientX, aEvt.clientY) == -1)
            aEvt.preventDefault();
    },
    buy:        function (aEvt) {
        var type = getListByName('buy').getItemTypeAt(aEvt.clientX, aEvt.clientY);
        type
            ? document.getElementById('btn-build').hidden = !getItemTypeByID(type).bp
            : aEvt.preventDefault()
    },
    acquired:   function (aEvt) { },
    spent:      function (aEvt) { },
};

const AllLists = {};
function List(name) {
    this._name = name;
    this._list = document.getElementById(name);
    document.getElementById(name+'-menu').addEventListener('popupshowing', showHide[name], true);
    this._items = {};
    this._order = [];
    this._list.view = this;
}
List.prototype = {
    addBP:      function (bp) {
        var id = bp.type + '_' + bp.me;
        if (!this._items[id]) {
            this._order.push(id);
            this._items[id] = {me: bp.me, runs: 0};
            this.treebox.rowCountChanged(this._order.length - 1, 1);
        }
        this._items[id].runs += bp.runs;
    },
    removeBP:   function (bp) {
        var id = bp.type + '_' + bp.me;
        this._items[id].runs -= bp.runs;
        if (!this._items[id].runs) {
            this._order = [i for each (i in this._order) if (i != item.type)];
            this.treebox.rowCountChanged(this._order.length - 1, -1);
        } else
            this.treebox.invalidate();
    },
    addItem:    function (item) {
        var q = this._items[item.type] || 0;
        if (!q) {
            this._order.push(item.type);
            this.treebox.rowCountChanged(this._order.length - 1, 1);
        }
        this._items[item.type] = q + item.quantity;
    },
    getItem:    function (typeID) {
        let total = this._items[typeID];
        return total ? new Item(typeID, total) : null;
    },
    removeItem: function (item) {
        var q = this._items[item.type] - item.quantity
        this._items[item.type] = q;
        if (!q) {
            this._order = [i for each (i in this._order) if (i != item.type)];
            this.treebox.rowCountChanged(this._order.length - 1, -1);
        } else
            this.treebox.invalidate();
    },
    get current()       this.getItem(this._order[this.selection.currentIndex]),
    getItemTypeAt:      function (x, y) this._order[this.getRowAt(x, y)],
    getRowAt:           function (x, y) this.treebox.getRowAt(x, y),
    get rowCount()      this._order.length,
    getCellText:        function (aRow, aCol) {
        var typeID = this._order[aRow], me;
        var cnt = this._items[typeID];
        if (cnt instanceof Object) {
            [typeID, me] = typeID.split('_');
            cnt = cnt.runs;
        }
        switch (aCol.id.substr(0,3)) {
        case 'itm': return getItemTypeByID(typeID).type.name;
        case 'cnt': return cnt;
        case 'isk': return 'N/A';
        case 'me-': return me || '';
        default:    return '';
        }
    },
    setCellText:        function (row,col,value) { },
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

function getListByName(name) {
    if (!AllLists[name])
        AllLists[name] = new List(name);
    return AllLists[name];
}

function addToProject1() {
    var params = {in: {dlg: 'add-to-proj'}, out: null};
    openDialog("chrome://jaet/content/tools/pp_dlg.xul", "", "chrome,dialog,modal", params).focus();
    if (!params.out.count)
        return;
    let stm = Stms.getTypeByName;
    stm.params.tn = params.out.typeName;
    stm.step();
    var typeID = stm.row.typeID;
    stm.reset();
    addToProject(typeID, params.out.count);
}

function addToProject(typeID, count) {
    var item = new Item(typeID, count);
    getListByName('order').addItem(item);
    getListByName('buy').addItem(item);
    LOG('add '+typeID+' '+count);
}

function removeFromProject1() {
    let proj = getListByName('order');
    let buy = getListByName('buy');
    var item = buy.getItemTypeByID(proj.current.type);
    if (!item) {
        alert("Can't remove item from project - not in 'to buy' list!");
        return;
    }
    var params = {in: {dlg: 'buy-build', amount: item.quantity}};
    openDialog("chrome://jaet/content/tools/pp_dlg.xul", "", "chrome,dialog,modal", params).focus();
    if (!params.out.count)
        return;
    item = new Item(item.type, params.out.count);
    proj.removeItem(item);
    buy.removeItem(item);
    LOG('remove '+item.type+' '+item.quantity);
}

/* move from 'to buy' to 'to build' or vice versa */
function buyBuild(action) {
    let src = getListByName(action == 'buy' ? 'build' : 'buy');
    let dst = getListByName(action);
    var item = src.current;
    if (!item)
        return;
    var params = {in: {dlg: 'buy-build', amount: item.quantity}};
    openDialog("chrome://jaet/content/tools/pp_dlg.xul", "", "chrome,dialog,modal", params).focus();
    if (!params.out.count)
        return;
    item = new Item(item.type, params.out.count);
    /* modify mats */  
    wantToBuild(item.type, action == 'build' ? params.out.count : -params.out.count);
    src.removeItem(item);
    dst.addItem(item);
    LOG('want-to-build '+item.type+' '+item.quantity);
}

function wantToBuild(typeID, count) { // count can be negative
    let buy = getListByName('buy');
    let build = getListByName('build');
    let type = getItemTypeByID(typeID);
    var bp_list = [];

    let (me_list = getBPMEList(typeID)) {
        var spent_list = [];
        var spent = build.getItem(typeID);
        if (spent)
            for (var i = 0; i < spent.quantity; i++)
                spent_list.unshift(me_list.next());
        if (count > 0)
            for (var i = 0; i < count; i++)
                bp_list.push(me_list.next());
        else
            bp_list = spent_list.slice(0, -count);
    }

    var waste = type.waste/100, mats = {}, fakes = 0;
    [mats[i] = 0 for (i in type.raw)];
    for each (bp in bp_list) {
        var wasteMul = 1 + waste/(1+bp.me);
        for (let [m,q] in Iterator(type.raw))
            mats[m] += Math.round(wasteMul*q);
        fakes += bp.fake;
    }

    for (let [m, q] in Iterator(mats))
        if (q)
            buy[count > 0 ? 'addItem' : 'removeItem'](new Item(m, q));

    if (fakes)
        buy[count > 0 ? 'addBP' : 'removeBP'](new Blueprint(type.bp, typeID, 0, fakes));
}

function boughtIt1() {
    let buy = getListByName('buy');
    
}

function load(projName) {
    
}

function save(projName) {
    
}

function pp_tab_onLoad() {
    gEIS = Cc["@aragaer/eve/inventory;1"].getService(Ci.nsIEveInventoryService);
    gDB  = Cc["@aragaer/eve/db;1"].getService(Ci.nsIEveDBService);
    var conn = gDB.getConnection();
    for (i in Queries)
        try {
            Stms[i] = conn.createStatement(Queries[i]);
        } catch (e) {
            dump("production planner: "+e+"\n"+conn.lastErrorString+"\n");
        }

    [getListByName(i) for (i in showHide)];
}

