var gEIS, gDB, gPC;
var tabbox;
const Queries = {
    getTypeByName:  "select typeID from invTypes where typeName=:tn",
    getBPByType:    "select blueprintTypeID, wasteFactor from invBlueprintTypes where productTypeID=:tid",
    getRawMats:     "select materialTypeID as tid, quantity from invTypeMaterials where typeID=:tid",
    getExtraMats:   "select requiredTypeID as tid, quantity, damagePerJob from ramTypeRequirements " +
            "where typeID=:bpid;",
};
const Stms = { };

const AllItemTypes = {};

function ItemType(typeID) {
    this.id = typeID;
    this._type = this._bp = this._uses = null;
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
            println("Production planner: getBPByType for "+this.id+": "+e);
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
    // TODO: get extra()
    get price() {
        this.__defineGetter__('price', function () this._price);
        return this._price = Math.round(gPC.getPriceForItem(this.id, null)*100)/100;
    },
};

const showHide = {
    order:      function (aEvt) {
        let order = tabbox.tabpanels.selectedPanel.orderView;
        order.activeRow = order.treebox.getRowAt(aEvt.clientX, aEvt.clientY);
        document.getElementById('btn-remove').hidden = order.activeRow == -1;
    },
    build:      function (aEvt) {
        let build = tabbox.tabpanels.selectedPanel.buildView;
        build.activeRow = build.treebox.getRowAt(aEvt.clientX, aEvt.clientY);
        if (build.activeRow == -1)
            aEvt.preventDefault();
    },
    buy:        function (aEvt) {
        let buy = tabbox.tabpanels.selectedPanel.buyView;
        buy.activeRow = buy.treebox.getRowAt(aEvt.clientX, aEvt.clientY);
        if (buy.activeRow == -1 || !buy.active.itm)
            aEvt.preventDefault();
    },
    acquired:   function (aEvt) {
        let acquired = tabbox.tabpanels.selectedPanel.acquiredView;
        acquired.activeRow = acquired.treebox.getRowAt(aEvt.clientX, aEvt.clientY);
        if (acquired.activeRow == -1 || !acquired.active.itm)
            aEvt.preventDefault();
    },
    spent:      function (aEvt) { },
};

function TreeView() { }
TreeView.prototype = {
    values:             [],
    get rowCount()      this.values.length,
    get active()        this.values[this.activeRow],
    getCellText:        function (aRow, aCol) this.values[aRow][aCol.id] || '??',
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

function OrderTreeView() { }
OrderTreeView.prototype = new TreeView();
OrderTreeView.prototype.rebuild = function () {
    this.treebox.rowCountChanged(0, -this.values.length);
    this.values = [];
    for each (itm in this.pr.project.order)
        this.values.push({
            type:   itm.type,
            itm:    getItemTypeByID(itm.type).type.name,
            cnt:    itm.cnt.toLocaleString()
        });
    this.treebox.rowCountChanged(0, this.values.length);
}

function SpentTreeView() { }
SpentTreeView.prototype = new TreeView();
SpentTreeView.prototype.rebuild = function () {
    this.treebox.rowCountChanged(0, -this.values.length);
    this.values = [];
    for each (itm in this.pr.project.spent)
        this.values.push({
            type:   itm.type,
            itm:    itm.type == 'isk' ? 'ISK' : getItemTypeByID(itm.type).type.name,
            cnt:    itm.cnt.toLocaleString(),
        });
    this.treebox.rowCountChanged(0, this.values.length);
}

function BuyTreeView() { }
BuyTreeView.prototype = new TreeView();
BuyTreeView.prototype.isSeparator = function (aRow) !this.values[aRow].itm;
BuyTreeView.prototype.rebuild = function () {
    this.treebox.rowCountChanged(0, -this.values.length);
    this.values = [];
    let tmp = this.tmp = {};
    let tmpbp = this.tmpbp = {};
    for each (itm in this.pr.project.order)
        tmp[itm.type] = itm.cnt;
    for each (itm in this.pr.project.build) {
        if (!tmp[itm.type])
            tmp[itm.type] = 0;
        tmp[itm.type] -= itm.cnt;
        println("Removed "+itm.cnt+" of "+itm.type+" from buy list, "+tmp[itm.type]+" left");
        var type = getItemTypeByID(itm.type);
        var waste = type.waste/100;
        var cnt = itm.cnt;
        var me_list = this.pr.project.getBPMEList();
        while (cnt) {
            var bp = me_list.next();
            var wasteMul = 1 + waste/(1+bp.me);
            var q = Math.min(cnt, bp.cnt);
            for (let [m,u] in Iterator(type.raw)) {
                if (!tmp[m])
                    tmp[m] = 0;
                tmp[m] += q*Math.round(wasteMul*u);
            }
            if (bp.fake)
                tmpbp[type.bp] = q;
            cnt -= q;
        }
    }
    for each (itm in this.pr.project.acquired) {
        if (!tmp[itm.type])
            tmp[itm.type] = 0;
        tmp[itm.type] -= itm.cnt;
    }
    for (i in tmpbp) {
        if (tmpbp[i] <= 0)
            continue;
        var type = getItemTypeByID(i);
        this.values.push({
            type:   i,
            itm:    type.type.name,
            cnt:    tmpbp[i],
            isk:    'N/A',
        });
    }
    if (this.values.length)
        this.values.push({itm: false});
    for (i in tmp) {
        if (tmp[i] <= 0)
            continue;
        var type = getItemTypeByID(i);
        this.values.push({
            type:   i,
            itm:    type.type.name,
            cnt:    tmp[i],
            isk:    type.price.toLocaleString(),
        });
    }
    this.treebox.rowCountChanged(0, this.values.length);
}

function BuildTreeView() { }
BuildTreeView.prototype = new TreeView();
BuildTreeView.prototype.rebuild = function () {
    this.treebox.rowCountChanged(0, -this.values.length);
    this.values = [];
    for each (itm in this.pr.project.build)
        this.values.push({
            type:   itm.type,
            itm:    getItemTypeByID(itm.type).type.name,
            cnt:    itm.cnt.toLocaleString()
        });
    this.treebox.rowCountChanged(0, this.values.length);
}

function AcquiredTreeView() { }
AcquiredTreeView.prototype = new TreeView();
AcquiredTreeView.prototype.isSeparator = function (aRow) !this.values[aRow].itm;
AcquiredTreeView.prototype.rebuild = function () {
    this.treebox.rowCountChanged(0, -this.values.length);
    this.values = [];
    for each (itm in this.pr.project.blueprints)
        this.values.push({
            type:   itm.type,
            itm:    getItemTypeByID(itm.type).type.name,
            me:     itm.me,
            cnt:    itm.cnt || Infinity,
        });
    if (this.values.length)
        this.values.push({itm: false});
    for each (itm in this.pr.project.acquired)
        this.values.push({
            itm:    getItemTypeByID(itm.type).type.name,
            cnt:    itm.cnt.toLocaleString()
        });
    this.treebox.rowCountChanged(0, this.values.length);
}

function Project(box) {
    this.box = box;
    this.order = {};
    this.blueprints = {};
    this.acquired = {};
    this.build = {};
    this.spent = {};
    this._log = [];
}
Project.prototype = {
    log:            function (text) {
        this._log.push(text);
        println(text);
    },
    addToOrder:     function (typeID, count) {
        if (!this.order[typeID])
            this.order[typeID] = {type: typeID, cnt: 0};
        this.order[typeID].cnt += count;
        this.box.orderView.rebuild();
        this.box.buyView.rebuild();
        this.log('Add '+typeID+' x'+count);
    },
    removeFromOrder:function (typeID, count) {
        this.order[typeID].cnt -= count;
        if (!this.order[typeID].cnt)
            delete(this.order[typeID]);
        this.box.orderView.rebuild();
        this.box.buyView.rebuild();
        this.log('Remove '+typeID+' x'+count);
    },
    getBPMEList:    function (typeID, count) {
        var bpID = getItemTypeByID(typeID).bp;
        for each (bp in [i for each (i in this.blueprints) if (i.type == bpID)].
                sort(function (a, b) b.me - a.me))
            yield {cnt: bp.cnt, me: bp.me};
        yield {cnt: Infinity, me: 0, fake: true};
    },
    wantToBuild:    function (typeID, count) { // count can be negative
        if (!this.build[typeID])
            this.build[typeID] = {type: typeID, cnt: 0};
        this.build[typeID].cnt += count;
        if (!this.build[typeID].cnt)
            delete(this.build[typeID]);
        this.box.buildView.rebuild();
        this.box.buyView.rebuild();
        this.log('Build '+typeID+' x'+count);
    },
};

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
    tabbox.tabpanels.selectedPanel.project.addToOrder(typeID, params.out.count);
}

function removeFromProject1() {
    let project = tabbox.tabpanels.selectedPanel.project;
    let order = tabbox.tabpanels.selectedPanel.orderView;
    let buy = tabbox.tabpanels.selectedPanel.buyView;
    let item = order.active;
    if (buy.tmp[item.type] <= 0) {
        alert("Can't remove item from project - not in 'to buy' list!");
        return;
    }
    var params = {in: {dlg: 'buy-build', amount: buy.tmp[item.type]}};
    openDialog("chrome://jaet/content/tools/pp_dlg.xul", "", "chrome,dialog,modal", params).focus();
    if (!params.out.count)
        return;
    project.removeFromOrder(item.type, params.out.count);
}

/* move from 'to buy' to 'to build' or vice versa */
function buyBuild(action) {
    let project = tabbox.tabpanels.selectedPanel.project;
    let build = tabbox.tabpanels.selectedPanel.buildView;
    let buy = tabbox.tabpanels.selectedPanel.buyView;
    let src = action == 'buy'
        ? build
        : buy;
    if (!src.active)
        return;
    var params = {in: {dlg: 'buy-build', amount: src.active.cnt}};
    openDialog("chrome://jaet/content/tools/pp_dlg.xul", "", "chrome,dialog,modal", params).focus();
    if (!params.out.count)
        return;
    project.wantToBuild(src.active.type, action == 'build' ? params.out.count : -params.out.count);
}

function gotIt1(spend_isk) {
    let buy = Lists.buy;
    let spent = Lists.spent;
    let itm = buy.current;
    var params = {in: itm.constructor == Blueprint
        ? {dlg: 'blueprint'}
        : {dlg: 'buy-build', amount: itm.quantity}
    };
    openDialog("chrome://jaet/content/tools/pp_dlg.xul", "", "chrome,dialog,modal", params).focus();
    if (!params.out.count)
        return;
    gotItem(itm.type, params);
    if (params.in.dlg == 'blueprint') {
        if (spend_isk)
            spent.addItem(new Item('isk', getItemTypeByID(itm.type).price));
        else if (params.out.count != Infinity)
            spent.addBP(new Blueprint(itm.type, params.out.me || 0, params.out.count));
    } else {
        if (spend_isk)
            spent.addItem(new Item('isk', getItemTypeByID(itm.type).price*params.out.count));
        else
            spent.addItem(new Item(itm.type, params.out.count));
    }
    LOG('buy '+itm.type+' '+params.out.count);
}

function gotItem(typeID, params) {
    let buy = Lists.buy;
    let acquired = Lists.acquired;
    let build = Lists.build;
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

function init() {
    if (gEIS)
        return;
    gEIS = Cc["@aragaer/eve/inventory;1"].getService(Ci.nsIEveInventoryService);
    gDB  = Cc["@aragaer/eve/db;1"].getService(Ci.nsIEveDBService);
    gPC  = Cc["@aragaer/eve/market-data/provider;1?name=eve-central"].
            getService(Ci.nsIEveMarketDataProviderService);
    var conn = gDB.getConnection();
    tabbox = document.getElementById('tabbox');
    if (!conn.tableExists('projects'))
        conn.createTable('projects', 'projectID integer primary key autoincrement not null, ' +
            'projectName char, projectDescr char, projectData char');

    for (i in Queries)
        try {
            Stms[i] = conn.createStatement(Queries[i]);
        } catch (e) {
            dump("production planner: "+e+"\n"+conn.lastErrorString+"\n");
        }

    for (i in showHide)
        document.getElementById(i+'-menu').addEventListener('popupshowing', showHide[i], true);
}

function ppOnload() {
    init();
    var conn = gDB.getConnection();
    getNameStm = conn.createStatement("select projectName from projects where projectID=:id");
    saveNameStm = conn.createStatement("insert into projects (projectName) values(:pname)");
    checkNameStm = conn.createStatement("select projectID from projects where projectName=:pname");

    for each (id in getCharPref('jaet.production_planner.tabs', '').split(','))
        if (id)
            openPanel(id);
}

function openPanel(id) {
    var name, stm;
    if (id) {
        var stm = getNameStm;
        try {
            stm.params.id = id;
            if (stm.step())
                name = stm.row.projectName;
            else
                return alert("Project "+id+" is not found");
        } catch (e) {
            println("getNameStm: "+e);
        } finally {
            stm.reset();
        }
    } else
        name = "New project";

    var tabpanel = document.createElement('tabpanel');
    tabpanel.className = 'project';
    tabpanel.setAttribute('flex', 1);
    tabpanel.setAttribute('orient', 'vertical');
    var project = tabpanel.project = new Project(tabpanel);
    if (id)
        project.load(id);
    var item = tabbox.tabs.appendItem(name, id);
    tabbox.tabpanels.appendChild(tabpanel);
    tabpanel.rebuild();

    tabbox.selectedIndex = tabbox.tabs.getIndexOfItem(item);
    if (id)
        panelList.push(id);
}

function printObj(obj) {
    var serializer = Cc["@mozilla.org/xmlextras/xmlserializer;1"].createInstance(Ci.nsIDOMSerializer);
    println(XML(serializer.serializeToString(obj)).toXMLString());
}
