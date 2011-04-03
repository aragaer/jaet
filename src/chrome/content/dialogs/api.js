/* Control the 'api keys' window'
 * vim:ts=4:sw=4:expandtab:cindent
 */
function wrappedAcct(acct) {
    this.real = acct;
    this.fake = {};
    this.deleted = false;
}

function wrappinggetter(prop) {
    return function () this.fake[prop] || this.real[prop];
}

function wrappingsetter(prop) {
    return function (val) this.fake[prop] = val;
}

wrappedAcct.prototype = {
    isSaved:    function () [1 for (i in this.fake)].length == 0,
    store:      function () {
        for (i in this.fake)
            this.real[i] = this.fake[i];
        this.fake = {};
        this.real.store();
    }
};

['accountID', 'name', 'keyLimited', 'keyFull'].forEach(function (p) {
    wrappedAcct.prototype.__defineGetter__(p, wrappinggetter(p));
    wrappedAcct.prototype.__defineSetter__(p, wrappingsetter(p));
});

var fields;

const chars = [];
var acct_list, char_list;
var accts;
const AcctTreeView = {
    get rowCount()  accts.length,
    getCellText:    function (row,col) {
        let itm = accts[row];
        switch (col.id) {
        case 'name':
            return itm.name.length ? itm.name : 'Enter name..';
        case 'img':
            return itm.deleted ? 'Restore' : itm.isSaved() ? '' : 'Save';
        default:
            return '';
        };
    },
    setCellText:    function (row,col,value) accts[row].name = value,
    setTree:        function (treebox) this.treebox = treebox,
    isContainer:    function (row) false,
    isEditable:     function (row,col) true,
    isSeparator:    function (row) false,
    isSorted:       function () false,
    getLevel:       function (row) 0,
    getImageSrc:    function (row,col) {
        switch (true) {
        case col.id != 'img':
            return null;
        case accts[row].deleted:
            return 'chrome://jaet/content/images/dead.png';
        case !accts[row].isSaved():
            return 'chrome://jaet/content/images/store.png';
        default:
            return null;
        };
    },
    getRowProperties: function (row,props) {},
    getCellProperties: function (row,col,props) {},
    getColumnProperties: function (colid,col,props) {}
};

function close_api() {
    if (accts.some(function (a) !a.isSaved() || a.deleted)
            && !confirm("You have unsaved data. Discard?"))
        return;
    window.close();
}

function showHide(aEvt) {
    var tbo = acct_list.treeBoxObject;
    var row = { }, col = { }, child = { };

    // get the row, col and child element at the point
    tbo.getCellAt(aEvt.clientX, aEvt.clientY, row, col, child);

    document.getElementById('btn-check').hidden =
            document.getElementById('btn-remove').hidden =
            document.getElementById('btn-remove2').hidden =
            document.getElementById('btn-restore').hidden =
            document.getElementById('btn-save').hidden = (row.value == -1);

    if (row.value == -1)
        return;

    var itm = accts[row.value];
    document.getElementById('btn-check').disabled =
        (!itm.accountID || (itm.keyFull == '' && itm.keyLimited == ''));

    document.getElementById('btn-remove2').hidden = !itm.deleted;
    document.getElementById('btn-save').hidden = itm.isSaved();
    document.getElementById('btn-remove').hidden = itm.deleted;
    document.getElementById('btn-restore').hidden = (itm.isSaved() && !itm.deleted) || !itm.real.accountID;
}

function on_api_load() {
    acct_list = document.getElementById('acct-list');
    char_list = document.getElementById('char-list');

    acct_list.addEventListener('select', on_acct_select, true);
    acct_list.addEventListener('dblclick', on_acct_dclick, true);
    document.getElementById('acct-list-menu').addEventListener('popupshowing', showHide, true);
    fields = [document.getElementById(name) for each (name in ['accountID', 'keyLimited', 'keyFull'])];
    fields.forEach(function (el) el.addEventListener('change', update_data, true));

    reload_accts();
}

function empty_char_list() {
    while (char_list.hasChildNodes())
        char_list.removeChild(char_list.firstChild);
}

function on_acct_dclick(aEvt) {
    var tbo = acct_list.treeBoxObject;
    var row = { }, col = { }, child = { };

    // get the row, col and child element at the point
    tbo.getCellAt(aEvt.clientX, aEvt.clientY, row, col, child);

    if (row.value == -1)
        return;

    acct_list.startEditing(row.value, acct_list.columns.getNamedColumn('name'));
}

function on_acct_select(aEvt) {
    var row = acct_list.currentIndex;

    document.getElementById('ltd_ok').src = '';
    document.getElementById('full_ok').src = '';

    if (row == -1) {
        fields.forEach(function (el) {
            el.value = '';
            el.disabled = true;
        });

        document.getElementById('btn-check').disabled = true;
        document.getElementById('btn-remove').disabled = true;
        document.getElementById('btn-save').disabled = true;
        return;
    }

    empty_char_list();

    accts[row].real.getCharacters({}).forEach(function (ch)
        char_list.appendItem(ch.name)
    );

    fields.forEach(function (el) {
        el.value = accts[row][el.id];
        el.disabled = false;
    });

    document.getElementById('btn-remove').disabled = false;
    document.getElementById('btn-save').disabled = false;
}

function update_data(aEvt) {
    var row = acct_list.currentIndex;
    if (row == -1)
        return;

    accts[row][aEvt.target.id] = aEvt.target.value;
}

function check_data() {
    var row = acct_list.currentIndex;
    if (row == -1)
        return;

    var tmp = Cc["@aragaer/eve/account;1"].createInstance(Ci.nsIEveAccount);
    for each (var i in ['accountID', 'keyLimited', 'keyFull'])
        tmp[i] = accts[row].fake[i] || accts[row].real[i];
    tmp.checkLimited(function (ret) {
        if (ret) {
            empty_char_list();

            tmp.getCharacters({}).forEach(function (ch)
                char_list.appendItem(ch.name)
            );

            document.getElementById('ltd_ok').src = 'chrome://jaet/content/images/ok.png';
            tmp.checkFull(function (ret) {
                document.getElementById('full_ok').src = ret
                    ? 'chrome://jaet/content/images/ok.png'
                    : 'chrome://jaet/content/images/bad.png';
            });
        } else {
            document.getElementById('ltd_ok').src = 'chrome://jaet/content/images/bad.png';
            document.getElementById('full_ok').src = '';
        }
    });
}

function add_acct() {
    accts.push(new wrappedAcct(Cc["@aragaer/eve/account;1"].createInstance(Ci.nsIEveAccount)));
    acct_list.view = AcctTreeView;
}

function reload_accts() {
    accts = Cc["@aragaer/eve/auth-manager;1"].getService(Ci.nsIEveAuthManager).
        getAccounts({}).map(function (a) new wrappedAcct(a));
    acct_list.view = AcctTreeView;
}

function remove_data() {
    var row = acct_list.currentIndex;
    if (row == -1)
        return;

    if (!confirm("Are you sure you want to delete accout '"+accts[row].name+"'?"))
        return;

    if (accts[row].real.accountID)
        accts[row].deleted = true;
    else {
        accts.splice(row, 1);
        acct_list.view = AcctTreeView;
    }
}

function restore_data() {
    var row = acct_list.currentIndex;
    if (row == -1)
        return;

    accts[row].deleted = false;
    accts[row].fake = {};
    fields.forEach(function (el) el.value = accts[row][el.id]);
}

function save_data() {
    var row = acct_list.currentIndex;
    if (row == -1)
        return;

    accts[row].store();
}

function kill_data() {
    var row = acct_list.currentIndex;
    if (row == -1)
        return;

    if (!confirm("Are you sure you want to completely delete accout '"+accts[row].name+"'?"))
        return;

    accts[row].real.delete();
    accts.splice(row, 1);
    acct_list.view = AcctTreeView;
}
