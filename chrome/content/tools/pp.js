var gEIS, gDB, gPC, gPS;
var tabbox;
const Queries = {
    getTypeByName:  "select typeID from invTypes where typeName=:tn",
    getBPByType:    "select blueprintTypeID, wasteFactor from invBlueprintTypes where productTypeID=:tid",
    getRawMats:     "select materialTypeID as tid, quantity from invTypeMaterials where typeID=:tid",
    getExtraMats:   "select requiredTypeID as tid, quantity, damagePerJob from ramTypeRequirements " +
            "where typeID=:bpid;",
    getProjName:    "select projectName from projects where projectID=:id;",
    saveProjName:   "replace into projects (projectID, projectName) values (:id, :pname);",
    checkProjName:  "select projectID from projects where projectName=:pname;",
    saveProj:       "update projects set projectData=:pdata where projectID=:id",
    loadProj:       "select projectData from projects where projectID=:id",
};
const Stms = { };

const AllItemTypes = {};

function ItemType(typeID) {
    this.id = typeID;
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
        document.getElementById('btn-build').hidden = !getItemTypeByID(buy.active.type).bp;
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
BuyTreeView.prototype.isBlueprint = function (aRow) aRow < this.bpCount;
BuyTreeView.prototype.rebuild = function () {
    this.treebox.rowCountChanged(0, -this.values.length);
    this.values = [];
    let tmp = this.tmp = {};
    let tmpbp = this.tmpbp = {};
    this.bpCount = 0;
    for each (itm in this.pr.project.order)
        tmp[itm.type] = itm.cnt;
    for each (itm in this.pr.project.build) {
        if (!tmp[itm.type])
            tmp[itm.type] = 0;
        tmp[itm.type] -= itm.cnt;
        var type = getItemTypeByID(itm.type);
        var waste = type.waste/100;
        var cnt = itm.cnt;
        var me_list = this.pr.project.getBPMEList(itm.type);
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
        this.bpCount++;
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
            cnt:    tmp[i].toLocaleString(),
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
            type:   itm.type,
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
        this.saved = false;
    },
    _safeAdd:       function (list, id, cnt, type) {
        if (!list[id])
            list[id] = {type: type || id, cnt: 0}; // id and id are different for blueprints
        list[id].cnt += cnt;
        if (!list[id].cnt)
            delete(list[id]);
    },
    addToOrder:     function (typeID, count) {
        this._safeAdd(this.order, typeID, count);
        this.box.orderView.rebuild();
        this.box.buyView.rebuild();
        this.log('Add '+typeID+' x'+count);
    },
    getBPMEList:    function (typeID) {
        var bpID = getItemTypeByID(typeID).bp;
        for each (bp in [i for each (i in this.blueprints) if (i.type == bpID)].
                sort(function (a, b) b.me - a.me))
            yield {cnt: bp.cnt, me: bp.me};
        yield {cnt: Infinity, me: 0, fake: true};
    },
    wantToBuild:    function (typeID, count) { // count can be negative
        this._safeAdd(this.build, typeID, count);
        this.box.buildView.rebuild();
        this.box.buyView.rebuild();
        this.log('Build '+typeID+' x'+count);
    },
    gotItem:        function (typeID, count, spend_isk) {
        this._safeAdd(this.acquired, typeID, count);
        this.log(['got', 'kept', 'bought', 'sold'][(count < 0) + 2 * spend_isk] + ' ' +
                typeID+ ' x'+count);
        if (spend_isk)
            [typeID, count] = ['isk', getItemTypeByID(typeID).price];
        this._safeAdd(this.spent, typeID, count);
        this.box.buyView.rebuild();
        this.box.acquiredView.rebuild();
        this.box.spentView.rebuild();
    },
    gotBP:          function (bpID, runs, me, spend_isk) {
//TODO: rewrite this porn
        var id = bpID+'_'+me;
        this._safeAdd(this.blueprints, id, runs, bpID);
        if (this.blueprints[id])
            this.blueprints[id].me = me;
        this.log(['got', 'kept', 'bought', 'sold'][(runs < 0) + 2 * spend_isk] + ' ' +
                bpID+ ' x'+runs);
        if (runs !== Infinity) {
//        if (spend_isk)
//            [id, runs, bpID] = ['isk', getItemTypeByID(typeID).price, null];
            this._safeAdd(this.spent, bpID, runs);
        }
        this.box.buyView.rebuild();
        this.box.acquiredView.rebuild();
        this.box.spentView.rebuild();
    },
    load:           function (id) {
        this.id = id;
        let stm = Stms.loadProj;
        stm.params.id = id;
        try {
            stm.step();
            var data = JSON.parse(stm.row.projectData);
            for each (i in ['order', 'blueprints', 'acquired', 'build', 'spent'])
                this[i] = data[i];
            for each (bp in this.blueprints)
                if (bp.cnt == 0)
                    bp.cnt = Infinity;
            this.log("Loaded "+id);
            this.saved = true;
        } catch (e) {
            println("Load project "+id+": "+e);
        } finally {
            stm.reset();
        }
        this.box.rebuild();
    },
    save:           function (id) {
        id = id || this.id;
        var data = {};
        for each (i in ['order', 'blueprints', 'acquired', 'build', 'spent'])
            data[i] = this[i];
        for each (bp in this.blueprints)
            if (bp.cnt == Infinity)
                bp.cnt = 0;
        let stm = Stms.saveProj;
        try {
            stm.params.id = id;
            stm.params.pdata = JSON.stringify(data);
            stm.execute();
            this.log("Saved "+id);
            this.saved = true;
        } catch (e) {
            println("Save project "+id+": "+e);
        } finally {
            stm.reset();
        }
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
    project.addToOrder(item.type, -params.out.count);
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
    let project = tabbox.tabpanels.selectedPanel.project;
    let buy = tabbox.tabpanels.selectedPanel.buyView;
    let itm = buy.active;
    var params = {in: buy.isBlueprint(buy.activeRow)
        ? {dlg: 'blueprint'}
        : {dlg: 'buy-build', amount: itm.cnt}
    };
    openDialog("chrome://jaet/content/tools/pp_dlg.xul", "", "chrome,dialog,modal", params).focus();
    if (!params.out.count)
        return;
    if (params.in.dlg == 'blueprint')
        project.gotBP(itm.type, params.out.count, params.out.me || 0, spend_isk);
    else
        project.gotItem(itm.type, params.out.count, spend_isk);
}

function init() {
    if (gEIS)
        return;
    gEIS = Cc["@aragaer/eve/inventory;1"].getService(Ci.nsIEveInventoryService);
    gDB  = Cc["@aragaer/eve/db;1"].getService(Ci.nsIEveDBService);
    gPC  = Cc["@aragaer/eve/market-data/provider;1?name=eve-central"].
            getService(Ci.nsIEveMarketDataProviderService);
    gPS  = Cc["@mozilla.org/embedcomp/prompt-service;1"].getService(Ci.nsIPromptService);
    var conn = gDB.getConnection();
    tabbox = document.getElementById('tabbox');
    if (!conn.tableExists('projects'))
        conn.createTable('projects', 'projectID integer primary key autoincrement not null, ' +
            'projectName char, projectDescr char, projectData char');

    for (i in Queries)
        try {
            Stms[i] = conn.createStatement(Queries[i]);
        } catch (e) {
            dump("production planner '"+Queries[i]+"': "+e+"\n"+conn.lastErrorString+"\n");
        }

    for (i in showHide)
        document.getElementById(i+'-menu').addEventListener('popupshowing', showHide[i], true);
}

function ppOnload() {
    init();
    var conn = gDB.getConnection();

    for each (id in getCharPref('jaet.production_planner.tabs', '').split(','))
        if (id)
            openPanel(id);
}

function openPanel(id) {
    var name, stm;
    if (id) {
        let stm = Stms.getProjName;
        try {
            stm.params.id = id;
            if (stm.step())
                name = stm.row.projectName;
            else
                return gPS.alert(null, "Project not found", "Project "+id+" is not found");
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
    var item = tabbox.tabs.appendItem(name, id);
    tabbox.tabpanels.appendChild(tabpanel);
    if (id)
        project.load(id);
    tabbox.selectedIndex = tabbox.tabs.getIndexOfItem(item);
}

function ppQuit() {
    if (!gPS.confirm(null, "Quit", "Really quit Production Planner?"))
        return;

    var flags = gPS.BUTTON_POS_0 * gPS.BUTTON_TITLE_SAVE |
        gPS.BUTTON_POS_1 * gPS.BUTTON_TITLE_IS_STRING |
        gPS.BUTTON_POS_2 * gPS.BUTTON_TITLE_CANCEL;
    var panelList = [];
tabpanels:
    for (var tp = tabbox.tabpanels.firstChild; tp; tp = tp.nextSibling) {
        let project = tp.project;
        tabbox.selectedPanel = tp;
        while (!project.saved) {
            switch (gPS.confirmEx(null, "Not saved", "Project '"+tabbox.selectedTab.label+
                    "' is not saved\nDiscard changes?", flags, "", "Discard", "", null, {})) {
            case 0:
                save();
                break;
            case 1:
                if (project.id)
                    panelList.push(project.id);
                continue tabpanels;
            case 2:
                return;
            }
        }
        panelList.push(project.id);
    }
    Prefs.setCharPref('jaet.production_planner.tabs', panelList.join(','));
    doQuit(false);
}

function save() {
    let project = tabbox.selectedPanel.project;
    if (project.id === undefined) {
        /* do save as dialog */;
        var name, id;
        while (!name) {
            name = 'New project';
            if  (!gPS.prompt(null, "Save project", "Enter a name", name, null, {}))
                return;
            let (stm = Stms.checkProjName) {
                stm.params.pname = name;
                if (stm.step()) {
                    if (confirm("You already have a project named "+name+"\nOverwrite?"))
                        id = stm.row.projectID;
                    else
                        name = null;
                    stm.reset();
                    continue;
                }
                stm.reset();
            }
        }
        if (!id) {
            let (stm = Stms.saveProjName) {
                stm.params.pname = name;
                stm.execute();
                stm.reset();
            }
            let (stm = Stms.checkProjName) {
                stm.params.pname = name;
                stm.step();
                id = stm.row.projectID;
                stm.reset();
            }
        }
        project.id = id;
        tabbox.selectedTab.label = name;
    }
    project.save();
}

