const AllItemTypes = {};
var gEIS, gDB;
const Queries = {
    getTypeByName:  "select typeID from invTypes where typeName=:tn",
    getBPByType:    "select blueprintTypeID, wasteFactor from invBlueprintTypes where productTypeID=:tid",
    getRawMats:     "select materialTypeID as tid, quantity from invTypeMaterials where typeID=:tid",
    getExtraMats:   "select requiredTypeID as tid, quantity, damagePerJob from ramTypeRequirements " +
            "where typeID=:bpid;",
};
const Stms = { };

const Lists = { };

/*
 * Usage types:
 * extra    - is used "as is" - SUM(for each i in usedby, get amount*use_count)
 * raw      - add ME and wastage
 * blueprint - blueprint
 */

function usage(user, quantity, usageType) {
    this.user = user;
    this.quantity = quantity || 1;
    this.type = usageType || 'extra';
}

function itemType(typeID) {
    this.id = typeID;
    this.usedby = {}; /* keys - typeIDs, values - usage structs */
    this.acquired = [];
}

itemType.prototype = {
    get type() {
        if (!this._type)
            this._type = gEIS.getItemType(this.id);
        return this._type;
    },
    to_buy:     null,
    to_build:   null,
    spent:      null,
    get bp()    {
        if (this._bp)
            return this._bp;
        let stm = Stms.getBPByType;
        var waste;
        try {
            stm.params.tid = this.id;
            if (stm.step())
                this._bp = stm.row.blueprintTypeID;
                waste = stm.row.wasteFactor;
        } catch (e) {
            dump("Production planner: getBPByType :"+e+"\n");
        } finally {
            stm.reset();
        }
        let bp = AllItemTypes[this._bp] = new itemType(this._bp);
        bp.waste = waste;
        bp.usedby[this.id] = new usage(this, 1, 'blueprint');
        return this._bp;
    },
    get uses()  {
        if (this._uses)
            return this._uses;
        this._uses = {};
        let stm = Stms.getRawMats;
        try {
            stm.params.tid = this.id;
            while (stm.step()) {
                let mat = stm.row.tid, q = stm.row.quantity;
                this._uses[mat] = q;
                switch (true) {
                case !AllItemTypes[mat]:
                    AllItemTypes[mat] = new itemType(mat);
                    /* fall-through */
                case !AllItemTypes[mat].usedby[this.id]:
                    AllItemTypes[mat].usedby[this.id] = new usage(this, q, 'raw');
                    break;
                default:
                    AllItemTypes[mat].usedby[this.id].quantity += q;
                    break;
                }
            }
        } catch (e) {
            dump("Filling 'uses' for "+this._type.name+":"+e+"\n");
        } finally {
            stm.reset();
        }
        return this._uses;
    },
};

function entry(typeID) {
    this.id = typeID;
    this.type = AllItemTypes[typeID] || new itemType(typeID);
}

entry.prototype = {
    me:         null,
    amount:     0,
    listitem:   null,
};

const Project = {listitems: {}, uses: {}};

function ListItemValue (entry)
    entry.type.type.name + (entry.me ? ' (ME: '+entry.me+')' : '') + ' x' + entry.amount;

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
    if (!AllItemTypes[typeID])
        AllItemTypes[typeID] = new itemType(typeID);
    let itm = AllItemTypes[typeID];

    if (!Project.uses[typeID]) {
        Project.uses[typeID] = 0;
        Project.listitems[typeID] = Lists.order.appendItem(itm.type.name, typeID);
        itm.usedby.project = new usage(Project, count, 'extra');
    }
    Project.uses[typeID] += count;
    Project.listitems[typeID].label = itm.type.name + ' x' + Project.uses[typeID];

    if (!itm.to_buy) {
        itm.to_buy = new entry(typeID);
        itm.to_buy.listitem = Lists.to_buy.appendItem(itm.type.name, typeID);
    }

    itm.to_buy.amount += count;
    itm.to_buy.listitem.label = ListItemValue(itm.to_buy);
}

/* move from 'to buy' to 'to build' or vice versa */
function buyBuild(action) {
    var src;
    switch (action) {
        case 'buy': src = 'to_build'; break;
        case 'build': src = 'to_buy'; break;
        default: return;
    }
    if (Lists[src].currentIndex == -1)
        return;

    var itm = AllItemTypes[Lists[src].value];
    var params = {in: {
            dlg: 'buy-build',
            itm: itm,
            amount: itm[src].amount
        }, out: null};
    openDialog("chrome://jaet/content/tools/pp_dlg.xul", "", "chrome,dialog,modal", params).focus();
    if (params.out.count)
        wantToBuild(itm, action == 'build' ? params.out.count : -params.out.count);
}

function wantToBuild(itm, count) { // count can be negative
    for each (src in ['to_buy', 'to_build'])
        if (!itm[src]) {
            itm[src] = new entry(itm.id);
            itm[src].listitem = Lists[src].appendItem(itm.type.name, itm.id);
        }

    var me_list = [{me: i.me, runs: i.amount} for each (i in AllItemTypes[itm.bp].acquired)].
        concat([{me: 0, runs: Infinity, fake: true}]).sort(function (a, b) b.me - a.me);
/* Debugging */
    dump("List of blueprints for "+itm.type.name+":\n");
    for each (i in me_list)
        dump(i.me+":"+i.runs+"\n");

    var spent = itm.to_build.amount;
    if (spent) {
        var spent_list = [];
        while (bp = me_list.shift())
            if (spent > bp.runs) {
                spent -= bp.runs;
                spent_list.push(bp);
            } else {
                bp.runs -= spent;
                me_list.unshift(bp);
                spent_list.push({me: bp.me, runs: spent, fake: bp.fake});
                break;
            }
        if (count < 0)
            me_list = spent_list.reverse();
    }
    dump("List of blueprints to use for "+itm.type.name+":\n");
    for each (i in me_list)
        dump(i.me+":"+i.runs+"\n");
    itm.to_build.amount += count;
    itm.to_buy.amount -= count;

    for each (src in ['to_buy', 'to_build'])
        if (!itm[src].amount) {
            Lists[src].removeChild(itm[src].listitem);
            itm[src] = null;
        } else
            itm[src].listitem.label = ListItemValue(itm[src]);
    
    var waste = AllItemTypes[itm.bp].waste/100;
    var mats = {};
    [mats[i] = 0 for (i in itm.uses)];
    for each (bp in me_list) {
        var num = count > 0 ? Math.min(count, bp.runs) : -Math.min(-count, bp.runs);
        var wasteMul = 1 + waste/(1+bp.me);
        for (i in itm.uses) {
            var usage = AllItemTypes[i].usedby[itm.id];
            mats[i] += num*(usage.type == 'raw'
                ? Math.round(wasteMul*usage.quantity)
                : usage.quantity);
        }
        if (bp.fake)
            addMaterialsToBuy(itm.bp, num);
        count -= num;
        if (!count)
            break;
    }

    for (i in mats)
        addMaterialsToBuy(i, mats[i]);
}

function addMaterialsToBuy(typeID, quantity) { // Also remove - with negative quantity
    if (!AllItemTypes[typeID])
        AllItemTypes[typeID] = new itemType(typeID);
    var itm = AllItemTypes[typeID];
    if (!itm.to_buy)
        itm.to_buy = new entry(typeID);

    if (!itm.to_buy.listitem)
        itm.to_buy.listitem = Lists.to_buy.appendItem(itm.type.name, typeID);

    itm.to_buy.amount += quantity;
    if (!itm.to_buy.amount) {
        Lists.to_buy.removeChild(itm.to_buy.listitem);
        itm.to_buy = null;
    } else
        itm.to_buy.listitem.label = ListItemValue(itm.to_buy);
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

    Lists.order = document.getElementById('order');
    Lists.to_buy = document.getElementById('to-buy');
    Lists.to_build = document.getElementById('to-build');
    Lists.acquired = document.getElementById('acquired');

/* this is for testing only */
    let stm = Stms.getTypeByName;
    stm.params.tn = 'Orca';
    stm.step();
    var rifterTypeID = stm.row.typeID;
    stm.reset();
    
    addToProject(rifterTypeID, 10);
    let rifter = AllItemTypes[rifterTypeID];
    let bp = AllItemTypes[rifter.bp];
    let bpc = new entry(rifter.bp);
    bpc.amount = Infinity;
    bpc.me = 3;
    bp.acquired.push(bpc);
    Lists.acquired.appendItem(bp.type.name, rifter.bp).label = ListItemValue(bpc);

    var itmat0;
    for (i in rifter.uses) {
        itmat0 = AllItemTypes[i];
        break;
    }
    let bp = AllItemTypes[itmat0.bp];
    let bpc = new entry(itmat0.bp);
    bpc.amount = 50;
    bpc.me = 50;
    bp.acquired.push(bpc);
    Lists.acquired.appendItem(bp.type.name, itmat0.bp).label = ListItemValue(bpc);

//    wantToBuild(rifter, 5);
    
}

