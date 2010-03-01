var gEIS, gDB, gPC;
const Queries = {
    getTypeByName:  "select typeID from invTypes where typeName=:tn",
    getBPByType:    "select blueprintTypeID, wasteFactor from invBlueprintTypes where productTypeID=:tid",
    getRawMats:     "select materialTypeID as tid, quantity from invTypeMaterials where typeID=:tid",
    getExtraMats:   "select requiredTypeID as tid, quantity, damagePerJob from ramTypeRequirements " +
            "where typeID=:bpid;",
    clearProj:      "delete from projectData where projectID=:proj_id;",
    addToProj:      "insert into projectData values(:proj_id, :type_id, :state, :count, :me);",
    loadFromProj:   "select * from projectData where projectID=:proj_id;",
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
        return this._type = gEIS.getItemType(this.id);
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
    get price() {
        this.__defineGetter__('price', function () this._price);
        return this._price = Math.round(gPC.getPriceForItem(this.id, null)*100)/100;
    },
};
function Item(typeID, quantity) {
    this.type = typeID;
    this.quantity = quantity;
}
function Blueprint(typeID, me, runs) {
    this.type = typeID;
    this.me = me;
    this.runs = runs;
}

function getBPMEList(typeID) {
    var typeID = getItemTypeByID(typeID).bp;
    if (!AllBlueprints[typeID])
        AllBlueprints[typeID] = [];
    for each (bp in AllBlueprints[typeID].sort(function (a, b) b.me - a.me))
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
        var id = this._items[bp.type+'_0']
            ? bp.type + '_0'
            : bp.type + '_' + bp.me;
        this._items[id].runs -= bp.runs;
        if (this._items[id].runs <= 0) {
            this._items[id].runs = 0;
            this._order = [i for each (i in this._order) if (i != id)];
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
        switch (typeof total) {
            case 'object':
                [typeID, me] = typeID.split('_');
                return new Blueprint(typeID, total.me, total.runs);
            case 'undefined':   return null;
            default:            return new Item(typeID, total);
        }
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
    get allItems()      this._items,
    get current()       this.getItem(this._order[this.selection.currentIndex]),
    getItemTypeAt:      function (x, y) this._order[this.getRowAt(x, y)],
    getRowAt:           function (x, y) this.treebox.getRowAt(x, y),
    get rowCount()      this._order.length,
    getCellText:        function (aRow, aCol) {
        var typeID = this._order[aRow], me;
        var cnt = this._items[typeID];
        var isbp, isisk;
        var type = getItemTypeByID(typeID);
        if (cnt instanceof Object) {
            [typeID, me] = typeID.split('_');
            cnt = cnt.runs;
            isbp = 1;
            type = getItemTypeByID(typeID);
        } else if (typeID == 'isk')
            isisk = 1;
        switch (aCol.id.substr(0,3)) {
        case 'itm': return isisk ? 'ISK' : type.type.name;
        case 'cnt': return cnt.toLocaleString();
        case 'isk': return type ? type.price.toLocaleString() : 'N/A';
        case 'me-': return isbp ? +me : '';
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
    var item = buy.getItem(proj.current.type);
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

    for (let [m, q] in Iterator(mats)) {
        if (!q)
            continue;
        if (count > 0) {
            buy.addItem(new Item(m, q));
            continue;
        }
        var qs = [buy, build].map(function (l) {
            var itm = l.getItem(m);
            return itm ? itm.quantity : 0;
        });
        q = Math.min(q, qs[0] + qs[1]);
        if (q > qs[0])
            wantToBuild(m, qs[0] - q);
        buy.removeItem(new Item(m, q));
    }

    if (fakes)
        buy[count > 0 ? 'addBP' : 'removeBP'](new Blueprint(type.bp, 0, fakes));

    if (count > 0) {
        var item = new Item(typeID, count);
        buy.removeItem(item);
        build.addItem(item);
    } else {
        var item = new Item(typeID, -count);
        buy.addItem(item);
        build.removeItem(item);
    }
}

function boughtIt1() {
    let buy = getListByName('buy');
    let spent = getListByName('spent');
    let itm = buy.current;
    var params = {in: itm.constructor == Blueprint
        ? {dlg: 'blueprint'}
        : {dlg: 'buy-build', amount: itm.quantity}
    };
    openDialog("chrome://jaet/content/tools/pp_dlg.xul", "", "chrome,dialog,modal", params).focus();
    if (!params.out.count)
        return;
    gotItem(itm.type, params);
    spent.addItem(new Item('isk', getItemTypeByID(itm.type).price*(params.in.dlg == 'blueprint' ? 1 : params.out.count)));
    LOG('buy '+itm.type+' '+params.out.count);
}

function gotItem(typeID, params) {
    let buy = getListByName('buy');
    let acquired = getListByName('acquired');
    let build = getListByName('build');
    if (params.in.dlg == 'blueprint') {
        var bp = new Blueprint(typeID, params.out.me || 0, params.out.count);
        var in_prod;
        buy.removeBP(bp);
        acquired.addBP(bp);
        for (in_prod in build._items)
            if (getItemTypeByID(in_prod).bp == typeID)
                break;
        if (in_prod) {
            in_prod = build.getItem(in_prod);
            wantToBuild(in_prod.type, -in_prod.quantity);
        }
        if (!AllBlueprints[bp.type])
            AllBlueprints[bp.type] = [];
        AllBlueprints[bp.type].push({me: bp.me, runs: bp.runs});
        if (in_prod) {
            wantToBuild(in_prod.type, in_prod.quantity);
        }
    } else {
        var item = new Item(typeID, params.out.count);
        buy.removeItem(item);
        acquired.addItem(item);
    }
}

function load(projID) {
    let stm = Stms.loadFromProj;
    stm.params.proj_id = projID;
    var data = [];
    try {
        while (stm.step()) {
            var tmp = {
                state:  stm.row.state,
                type:   stm.row.typeID,
                cnt:    stm.row.count,
            };
            if (stm.row.me !== undefined)
                tmp.me = stm.row.me;
            data.push(tmp);
        }
    } catch (e) {
        var errstr = "Failed to clean project "+projID+": "+e;
        println(errstr);
        alert(errstr);
    } finally {
        stm.reset();
    }
    applyData(data);
}

function applyData(data) {
    for each (i in data)
        if (i.me !== undefined)
            getListByName(i.state).addBP(new Blueprint(i.type, +i.me, +str2inf(i.cnt)));
        else
            getListByName(i.state).addItem(new Item(i.type, i.cnt));
}

function inf2str(value) value == Infinity ? 'inf' : value
function str2inf(value) value == 'inf' ? Infinity : value

function gatherForSave() {
    var data = [];
    ['buy', 'build', 'acquired', 'spent', 'order'].forEach(function (l) {
        let itms = getListByName(l).allItems;
        for (i in itms) {
            var cnt = itms[i];
            var tmp = {state:l, cnt: cnt, type: i};
            if (cnt instanceof Object) {
                [tmp.type, tmp.me] = i.split('_');
                tmp.cnt = inf2str(cnt.runs);
            }
            if (tmp.cnt)
                data.push(tmp);
        }
    });
    return data;
}

function save(projID) {
    var conn = gDB.getConnection();
    var data = gatherForSave();
    if (projID === undefined)
        projID = projectID;
    conn.beginTransaction();
    let (stm = Stms.clearProj) {
        stm.params.proj_id = projID;
        try {
            stm.execute();
        } catch (e) {
            var errstr = "Failed to clean project "+projID+": "+e+"\n"+conn.lastErrorString;
            println(errstr);
            alert(errstr);
            conn.rollbackTransaction();
            return;
        } finally {
            stm.reset();
        }
    }
    let (stm = Stms.addToProj) {
        for each (d in data) {
            stm.params.proj_id = projID;
            stm.params.type_id = d.type;
            stm.params.state = d.state;
            stm.params.count = d.cnt;
            stm.params.me = d.me === undefined ? null : d.me;
            try {
                stm.execute();
            } catch (e) {
                var errstr = "Failed to store item "+d.type+" in project "+projID+": "+e+"\n"+conn.lastErrorString;
                println(errstr);
                alert(errstr);
                conn.rollbackTransaction();
                return;
            } finally {
                stm.reset();
            }
        }
    }
    conn.commitTransaction();
}

function pp_tab_onLoad() {
    gEIS = Cc["@aragaer/eve/inventory;1"].getService(Ci.nsIEveInventoryService);
    gDB  = Cc["@aragaer/eve/db;1"].getService(Ci.nsIEveDBService);
    gPC  = Cc["@aragaer/eve/market-data/provider;1?name=eve-central"].
            getService(Ci.nsIEveMarketDataProviderService);
    var conn = gDB.getConnection();

    if (!conn.tableExists('projectData'))
        conn.createTable('projectData', 'projectID int, typeID char, ' +
            'state char, count float, me int');

    for (i in Queries)
        try {
            Stms[i] = conn.createStatement(Queries[i]);
        } catch (e) {
            dump("production planner: "+e+"\n"+conn.lastErrorString+"\n");
        }

    if (projectID !== undefined)
        load(projectID);
}

