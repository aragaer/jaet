var gEIS, gDB;
const Queries = {
    getTypeByName:  "select typeID from invTypes where typeName=:tn",
    getBPByType:    "select blueprintTypeID, wasteFactor from invBlueprintTypes where productTypeID=:tid",
    getRawMats:     "select materialTypeID as tid, quantity from invTypeMaterials where typeID=:tid",
    getExtraMats:   "select requiredTypeID as tid, quantity, damagePerJob from ramTypeRequirements " +
            "where typeID=:bpid;",
};
const Stms = { };

function ProductionItem(type, count, cost, parent, is_raw) {
    this.type = gEIS.getItemType(type);
    this._count = count;
    this._cost = cost;
    this._parent = parent;
    this.is_raw = is_raw;
    this.level = parent
        ? parent.level + 1
        : 0;

    let stm = Stms.getBPByType;
    stm.params.tid = type;
    try {
        if (stm.step()) {
            this.bp = stm.row.blueprintTypeID;
            this.waste = stm.row.wasteFactor;
        }
    } catch (e) {
        dump("get BP by type:"+e+"\n");
    } finally {
        stm.reset();
    }

    this.open = false;
}

ProductionItem.prototype = {
    toString:       function () this.type.name,
    get materials() this.bp ? [].concat(this._rawmat || [], this._extramat || []) : null,
    get me()        this.bp ? this._me : "",
    get cost()      this.open ? "" : this._cost,
    get count()     {
        if (!this.is_raw || !this._parent._me)
            return this._count;
        var p = this._parent;
        return Math.round(this._count*(1 + p.waste/(1+p.me)/100));
    },
    get group()     this.type.group,
    get category()  this.type.category,
};

var productionTree, materialTree;
var productionTreeView = {
    _rootItem:          null,

    _getRowCount:       function (itm) {
        if (!itm)
            return 0;
        if (!itm.materials || !itm.open)
            return 1;
        var sum = 1;
        [sum += this._getRowCount(i) for each (i in itm.materials)];
        return sum;
    },
    get rowCount()      this._getRowCount(this._rootItem),

    _getRow:            function (itm, num) {
        if (num == 0)
            return itm;
        num--;
        if (!itm.materials || !itm.open)
            return null;
        for each (mat in itm.materials) {
            var count = this._getRowCount(mat);
            if (num < count)
                return this._getRow(mat, num);
            else
                num -= count;
        }
        dump("huh? "+num+" in "+itm.type.name+" is not found?\n");
        return null;
    },

    getCellText:        function (aRow, aCol) {
        var row = this._getRow(this._rootItem, aRow);
        if (!row)
            return '????';
        switch (aCol.id) {
            case 'itm': return row.type.name;
            case 'ME':  return row.me;
            case 'cnt': return row.count;
            case 'isk': return row.cost;
            default:    return null;
        }
    },
    setCellText:        function (row, col, value) {
        if (col.id != 'ME')
            return;
        var row = this._getRow(this._rootItem, aRow);
        row._me = value;
    },
    isEditable:         function (row,col) {
        if (col.id != 'ME')
            return false;
        var row = this._getRow(this._rootItem, aRow);
        return row.open;
    },
    isContainer:        function (aRow) {
        var row = this._getRow(this._rootItem, aRow);
        return row.bp != null;
    },
    isContainerOpen:    function (aRow) this._getRow(this._rootItem, aRow).open,
    isContainerEmpty:   function (aRow) false,
    getLevel:           function (aRow) this._getRow(this._rootItem, aRow).level,

    // TODO
    _getParentIndex:    function (itm, num) {
        var idx = 1;
        if (num == 0)
            return -1; // Parent is right above here
        for each (mat in itm.materials) {
            var count = this._getRowCount(mat);
            if (idx + count > num)
                return idx + this._getParentIndex(mat, num - idx);
            else
                idx += count;
        }
        dump("huh? "+num+" in "+itm.type.name+" is not found when looking for parent?\n");
        return -1;
    },

    getParentIndex:     function (aRow) this._getParentIndex(this._rootItem, aRow),
    hasNextSibling:     function (aRow, aAfterRow) {
        var itm = this._getRow(this._rootItem, aRow);
        var parent = itm._parent;
        if (!parent || !parent.materials || !parent.open)
            return false;
        return parent.materials[-1] == itm;
    },
    _loadMats:          function (arr, stm, parent, is_raw) { // Already prepared stm
        try {
            while (stm.step()) {
                var itm = new ProductionItem(stm.row.tid, stm.row.quantity, 0, parent, is_raw);
                if (itm.category.id != Ci.nsEveCategoryID.CATEGORY_SKILL)
                    arr.push(itm);
            }
        } catch (e) {
            dump("load materials: "+e+"\n");
        }
    },

    _fillMatList:       function (itm, names, list, mul) {
        if (itm.open)
            return [this._fillMatList(mat, names, list, mul*itm.count) for each (mat in itm.materials)];
        var name = itm.type.name;
        if (list[name])
            list[name].quantity += itm.count*mul;
        else {
            names.push(name);
            list[name] = { quantity : itm.count*mul }
        }
    },

    toggleOpenState:    function (aRow) {
        var row = this._getRow(this._rootItem, aRow);
        if (!row._rawmat) {
            row._rawmat = [];
            let stm = Stms.getRawMats;
            stm.params.tid = row.type.id;
            this._loadMats(row._rawmat, stm, row, true);
            stm.reset();
        }
        if (!row._extramat) {
            row._extramat = [];
            let stm = Stms.getExtraMats;
            stm.params.bpid = row.bp;
            this._loadMats(row._extramat, stm, row, true);
            stm.reset();
        }
        var count;
        if (row.open) {         // First count rows, then close
            count = 1 - this._getRowCount(row);
            row.open = false;
        } else {                // First open, then count rows
            row.open = true;
            count = this._getRowCount(row) - 1;
        }

        matnames = [];
        materialList = {};
        this._fillMatList(this._rootItem, matnames, materialList, 1);
        materialTree.view = materialTreeView;

        this.boxObject.rowCountChanged(aRow + 1, count);
        this.boxObject.invalidateRow(aRow);
    },
    isSeparator:        function (aRow) false,
    isSorted:           function () false,
    getImageSrc:        function (row,col) null,
    getRowProperties:   function (row,props) { },
    getCellProperties:  function (row,col,props) { },
    getColumnProperties: function (colid,col,props) { },

    set rootItem(typeName) {
        let stm = Stms.getTypeByName;
        stm.params.tn = typeName;
        try {
            stm.step();
            this._rootItem = new ProductionItem(stm.row.typeID, 1);
        } catch (e) {
            dump("set rootItem: "+e+"\n");
            this._rootItem = null;
        } finally {
            stm.reset();
        }
        matnames = [typeName];
        materialList[typeName] = {quantity: 1};
        materialTree.view = materialTreeView;
    },
    setTree:            function (aBoxObject) this.boxObject = aBoxObject,
};

var matnames = [];
var materialList = {};
var materialTreeView = {
    get rowCount()      matnames.length,
    getCellText:        function (aRow, aCol) {
        var data = materialList[matnames[aRow]];
        if (!data)
            return '???';
        switch(aCol.id) {
        case 'itm':     return matnames[aRow];
        case 'cnt':     return data.quantity;
        case 'isk':     return 0;
        default:        return '';
        }
    },
    setCellText:        function (row, col, value) { },
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

function selectProduct() {
    productionTreeView.rootItem = document.getElementById('item').value;
    productionTree.view = productionTreeView;
}

function productionPlannerOnLoad() {
    productionTree = document.getElementById('production');
    materialTree = document.getElementById('materials');
    gEIS = Cc["@aragaer/eve/inventory;1"].getService(Ci.nsIEveInventoryService);
    gDB  = Cc["@aragaer/eve/db;1"].getService(Ci.nsIEveDBService);
    var conn = gDB.getConnection();
    for (i in Queries)
        try {
            Stms[i] = conn.createStatement(Queries[i]);
        } catch (e) {
            dump("production planner: "+e+"\n"+conn.lastErrorString+"\n");
        }

    productionTree.view = productionTreeView;
    materialTree.view = materialTreeView;
}

