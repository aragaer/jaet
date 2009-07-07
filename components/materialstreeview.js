const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

/*  Materials
 *  id, mat, cnt, total, isk, date
 *  children, open
 */

function MaterialsTreeView() {
    this.materials = []; /* 1st level materials */
    var atomService = Cc['@mozilla.org/atom-service;1'].
        getService(Ci.nsIAtomService);

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
    _getManufacturingMaterials: function (aData, bpInfo) {
        if (!bpInfo.bpID)
            bpInfo.bpID = this.dataDB.doSelectQuery("select blueprintTypeId " +
                "from invBlueprintTypes where productTypeID="+bpInfo.itemID+";");

        if (!bpInfo.bpID) {
            dump("No blueprint for item "+bpInfo.item+"\n");
            return;
        }
        this.dataDB.doSelectQuery("select quantity, requiredTypeID, typeName, blueprintTypeID " +
            " from typeActivityMaterials" +
            " left join invTypes on requiredTypeId=invTypes.typeId " +
            " left join invBlueprintTypes on productTypeID=invTypes.typeId " +
            " where typeActivityMaterials.typeID=" + bpInfo.bpID +
            " and activityID=1 " +
            " and invTypes.groupID not in (select groupID from invGroups where categoryID=16);",
            function (array) {
                aData.push({
                    id: array[1],
                    mat: array[2],
                    cnt: array[0]
                });
                if (array[3]) {
                    aData[aData.length-1].bp = {
                        bpID: array[3],
                        itemID: array[1],
                        item: array[2]
                    };
                    aData[aData.length-1].children = [];
                }
                array.splice(0);
            });
     },
     _getReprocessingMaterials: function (aData, bpInfo) {
         this.dataDB.doSelectQuery("select quantity, requiredTypeID, t3.typeName " +
            " from typeActivityMaterials as t2" +
            " left join invTypes as t3 on requiredTypeId=t3.typeId " +
            " where t2.typeID="+bpInfo.itemID+" and activityID=6;", function (array) {
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
    _getMaterials: function (aData, item, bpInfo) {
        if (!bpInfo) {
            var itemID = this.dataDB.doSelectQuery("select typeID, " +
                    "invGroups.groupID, invCategories.categoryID " +
                    "from invTypes " +
                    "left join invGroups " +
                        "on invTypes.groupID=invGroups.groupID " +
                    "left join invCategories " +
                        "on invGroups.categoryID = invCategories.categoryID " +
                    "where typeName='"+item+"';")[0];
            if (!itemID || !itemID[0]) {
                dump("No such item: ["+item+"]\n");
                return;
            }
            bpInfo = {
                itemID: itemID[0],
                grpID: itemID[1],
                catID: itemID[2]
            };
        }
	
        switch (this.type) {
        default:
        case 'manufacture':
            this._getManufacturingMaterials(aData, bpInfo);
            break;
        case 'reprocess':
            switch (true) {
            case bpInfo.grpID == 355:   /* Refinables */
            case bpInfo.catID == 25:    /* Asteroid (ore, ice) */
            default:
                this._getReprocessingMaterials(aData, bpInfo);
            }
            break;
        }
    },

    setTree: function (aBoxObject) {
        if (aBoxObject) {/* Fetch data from aBoxObject.element */
            var el = aBoxObject.element;
            this.dataDB = el.dataDB;
            this.priceDB = el.priceDB;
            this.type = el.type;
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

    _getTotal: function (aRow, cnt) {
        var parent_idx = this._getParentIndex(this.materials, aRow);
        return parent_idx == -1
            ? cnt
            : cnt * this._getTotal(parent_idx,
                    this._getRowElement(this.materials, parent_idx).cnt);
    },

    getCellText: function (aRow, aCol) {
        var element = this._getRowElement(this.materials, aRow);
        if (typeof element == 'undefined')
            return null;
        switch (aCol.id) {
        case 'total':
            return this._getTotal(aRow, element.cnt);
        default:
            return element[aCol.id];
        }
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
    _getParent: function (aData, aRow) {
        var currentIndex = 0;
        for (var i = 0; i < aData.length && aRow > currentIndex; i++) {
            currentIndex++;

            if ('children' in aData[i] && aData[i].open) {
                var count = this._getRowCount(aData[i].children);

                if (aRow < currentIndex + count)
                    return aData[i];
                currentIndex += count;
            }
        }
        return null;
    },
    _getParentIndex: function (aData, aRow) {
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
    getImageSrc: function(aRow, aCol) {},
    getProgressMode : function(aRow, aCol) {},  
    selection: null,
    selectionChanged: function () {},

    QueryInterface: XPCOMUtils.generateQI([Ci.nsITreeView]),
};

const EXPORTED_SYMBOLS = [MaterialsTreeView];
function NSGetModule(compMgr, fileSpec) {
    return XPCOMUtils.generateModule(EXPORTED_SYMBOLS);
}
