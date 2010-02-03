var assetsTreeView = {
    data:      [],
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
        return this._getRowCount(this.data);
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
        var parent_idx = this._getParentIndex(this.data, aRow);
        return parent_idx == -1
            ? cnt
            : cnt * this._getTotal(parent_idx,
                    this._getRowElement(this.data, parent_idx).cnt);
    },

    getCellText: function (aRow, aCol) {
        var data = this._getRowElement(this.data, aRow).item;
        switch(aCol.id) {
        case 'item':    return data.toString();
        case 'loc':     return data.locationString();
        case 'cont':    return data.containerString();
        case 'count':   return data.quantity;
        default:        return '';
        }
    },
    isContainer: function (aRow) {
        var element = this._getRowElement(this.data, aRow);
        return (typeof element != 'undefined' && 'children' in element);
    },
    isContainerOpen: function (aRow) {
        var element = this._getRowElement(this.data, aRow);
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
        return this._getLevel(this.data, aRow);
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
        return this._getParentIndex(this.data, aRow);
    },

    hasNextSibling: function (aRow, aAfterRow) {
        var parent = this.getParentIndex(aRow);
        var parentElement = this._getRowElement(this.data, parent);
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
        var element = this._getRowElement(this.data, aRow);
        var count = this._getRowCount(element.children);
        element.open = !element.open;
        this.treebox.rowCountChanged(aRow + 1, element.open ? count : -count);
        this.treebox.invalidateRow(aRow);
    },

    _fill:      function (where, data) {
        where.splice(0);

        for each (a in data) {
            var record = {item: a};
            if (a.isContainer()) {
                record.children = [];
                this._fill(record.children, a.getItemsInside({}));
            }
            where.push(record);
        }
    },
    fill:   function (data) {
        this._fill(this.data, data);
    },
    setTree: function (treebox) { this.treebox = treebox; },
    isSeparator: function (row) { return false; },
    isSorted: function () { return false; },
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
    assetsTreeView.fill(result);
    document.getElementById('assets').view = assetsTreeView;
}

function loadCAssets() {
    var ch = document.getElementById('character');
    var chid = EveApi.getCharByName(ch.value);

    if (chid == 0) {
        alert("No character '"+ch.value+"' found");
        return;
    }

    var result = EveApi.getCorporationAssets(chid);
    assetsTreeView.fill(result);
    document.getElementById('assets').view = assetsTreeView;
}

function onAssetsLoad() {
    document.getElementById('assets').view = assetsTreeView;
}
