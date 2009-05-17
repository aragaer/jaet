const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

/*  Materials
 *  id, mat, cnt, isk, date
 *  children, open
 */

function MaterialsTreeView() {
    this.materials = []; /* 1st level materials */
}

function leftPad(n, len) {
    if (!len)
        return n;
    return (new Array(len+1)).join("    ") + n;
}

MaterialsTreeView.prototype = {
    classDescription: "Materials Tree View",
    classID:          Components.ID("{c80ba2a5-7973-4578-b83c-beb4ab8b4dbd}"),
    contractID:       "@aragaer.com/materials-tree-view;1",

    clear: function () {
        this.materials.splice(0);
    },
    
    dataDB: null,
    priceDB: null,

    boxObject: null,
    _getMaterials: function (aData, item, bpID) {
        if (!bpID) {
            var itemID = this.dataDB.doSelectQuery("select typeID from invTypes where typeName='"+item+"';");
            if (itemID == 0) {
                dump("No such item: ["+item+"]\n");
                return;
            }
            bpID = this.dataDB.doSelectQuery("select blueprintTypeId from invBlueprintTypes where productTypeID="+itemID+";");
            if (bpID == 0) {
                dump("No blueprint for item ["+item+"]\n");
                return;
            }
        }

        this.dataDB.doSelectQuery("select quantity, requiredTypeID, typeName, blueprintTypeID " +
            " from typeActivityMaterials" +
            " left join invTypes on requiredTypeId=invTypes.typeId " +
            " left join invBlueprintTypes on productTypeID=invTypes.typeId " +
            " where typeActivityMaterials.typeID="+bpID+" and activityID=1;", function (array) {
                aData.push({
                    id: array[1],
                    mat: array[2],
                    cnt: array[0]
                });
                if (array[3]) {
                    aData[aData.length-1].bp = array[3];
                    aData[aData.length-1].children = [];
                }
                array.splice(0);
            });
    },

    setTree: function (aBoxObject) {
        if (aBoxObject) {/* Fetch data from aBoxObject.element */
            var el = aBoxObject.element;
            this.dataDB = el.dataDB;
            this.priceDB = el.priceDB;
            if (el.item)
                this._getMaterials(this.materials, el.item);

        } else {
            this.materials.splice(0);
            this.dataDB = this.priceDB = null;
        }
        this.boxObject = aBoxObject;
    },

    _getRowCount: function (aData) {
        var count = 0;
        for (var i = 0; i < aData.length; i++) {
            count++;
            if ('children' in aData[i] && aData[i].open)
                count += this._getRowCount(aData[i].children);
        }
        return count;
    },

    get rowCount() {
        return this._getRowCount(this.materials);
    },

    _getRowElement: function (aData, aRow) {
        for (var i = 0; i < aData.length && aRow > 0; i++) {
            aRow--;
            if ('children' in aData[i] && aData[i].open) {
                var count = this._getRowCount(aData[i].children);
                if (aRow < count)
                    return this._getRowElement(aData[i].children, aRow);
                else
                    aRow -= count;
            }
        }

        return (i < aData.length)
            ? aData[i]
            : undefined;
    },

    getCellText: function (aRow, aCol) {
        var element = this._getRowElement(this.materials, aRow);
        if (typeof element == 'undefined')
            return null;
        return aCol.id == 'mat'
            ? leftPad(element[aCol.id], this.getLevel(aRow))
            : element[aCol.id];
    },

    getColumnProperties: function (aCol, aProperties) { },
    getRowProperties: function (aRow, aProperties) {
        var element = this._getRowElement(this.materials, aRow);
        if (typeof element != 'undefined' && 'properties' in element) {
            for (var i = 0; i < element.properties.length; i++)
                    aProperties.AppendElement(element.properties[i]);
        }
    },
    getCellProperties: function (aRow, aCol, aProperties) {
        this.getColumnProperties(aCol, aProperties);
        this.getRowProperties(aRow, aProperties);
    },
    isSeparator: function (aRow) {
        var element = this._getRowElement(this.materials, aRow);
        return (typeof element != 'undefined' && 'separator' in element);
    },

    isContainer: function (aRow) {
        var element = this._getRowElement(this.materials, aRow);
        return (typeof element != 'undefined' && 'children' in element);
    },
    isContainerOpen: function (aRow) {
        var element = this._getRowElement(this.materials, aRow);
        return (typeof element != 'undefined' && element.open);
    },
    isContainerEmpty: function (aRow) { return false ; },
    _getLevel: function (aData, aRow) {
        for (var i = 0; i < aData.length && aRow > 0; i++) {
            aRow--;
            if ('children' in aData[i] && aData[i].open) {
                var count = this._getRowCount(aData[i].children);
                if (aRow < count)
                    return this._getLevel(aData[i].children, aRow) + 1;
                else
                    aRow -= count;
            }
        }

        return (i < aData.length)
            ? 0
            : -1;
    },
    getLevel: function (aRow) {
        return this._getLevel(this.materials, aRow);
    },
    _getParentIndex: function(aData, aRow) {
        var currentIndex = 0;
        for (var i = 0; i < aData.length && aRow > currentIndex; i++) {
            currentIndex++;

            if ('children' in aData[i] && aData[i].open) {
                var count = this._getRowCount(aData[i].children);

                if (aRow < currentIndex + count)
                    return currentIndex + this._getParentIndex(aData[i].children, aRow - currentIndex);

                currentIndex += count;
            }
        }
        return -1;
    },
    getParentIndex: function (aRow) {
        return this._getParentIndex(this.materials, aRow);
    },

    hasNextSibling: function (aRow, aAfterRow) {
        var parent = this.getParentIndex(aRow);
        var parentElement = this._getRowElement(this.materials, parent);
        if (typeof parentElement == 'undefined')
            return false;
        var data = parentElement.children;
        var child = parent + 1;
        for (var i = 0; i < data.length; i++) {
            if (child > aAfterRow)
                return true;

            child++;
            if ('children' in data[i] && data[i].open)
                child += this._getRowCount(data[i].children);
        }
        return false;
    },

    toggleOpenState: function (aRow) {
        var element = this._getRowElement(this.materials, aRow);
        if (typeof element == 'undefined' || !element.bp)
            return;

        if (!element.children.length)   /* Load it now */
            this._getMaterials(element.children, element.mat, element.bp);

        var count = this._getRowCount(element.children);
        element.open = !element.open;
        this.boxObject.rowCountChanged(aRow + 1, element.open ? count : -count);
        this.boxObject.invalidateRow(aRow);  
    },
    isSorted: function () { return false; },
    isEditable: function(aRow, aCol) { return false; },
    getImageSrc: function(aRow, aCol) {
        if (aCol.id != 'sp')
            return false;
        var element = this._getRowElement(this.materials, aRow);
        if (!('children' in element))
            return false;

        return element.open
            ? "chrome://jaet/content/img/collapse.gif"
            : "chrome://jaet/content/img/expand.gif";
    },  
    getProgressMode : function(aRow, aCol) {},  
    selection: null,
    selectionChanged: function () {},

    QueryInterface: XPCOMUtils.generateQI([Ci.nsITreeView]),
};

const EXPORTED_SYMBOLS = [MaterialsTreeView];
function NSGetModule(compMgr, fileSpec) {
    return XPCOMUtils.generateModule(EXPORTED_SYMBOLS);
}
