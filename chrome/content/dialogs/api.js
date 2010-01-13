/* Control the 'api keys' window'
 * vim:ts=4:sw=4:expandtab:cindent
 */

const chars = [];
var acct_list, api_id, api_ltd, api_full, char_list;
var accts;
const AcctTreeView = {
    get rowCount()  accts.length,
    getCellText:    function (row,col) accts[row].name || 'Enter name..',
    setCellText:    function (row,col,value) accts[row].name = value,
    setTree:        function (treebox) this.treebox = treebox,
    isContainer:    function (row) false,
    isEditable:     function (row,col) true,
    isSeparator:    function (row) false,
    isSorted:       function () false,
    getLevel:       function (row) 0,
    getImageSrc:    function (row,col) null,
    getRowProperties: function (row,props) {},
    getCellProperties: function (row,col,props) {},
    getColumnProperties: function (colid,col,props) {}
};

function close_api() {
    window.close();
}

function activate_check() {
    var id = api_id.value;
    var ltd = api_ltd.value;
    var full = api_full.value;

    document.getElementById('btn-check').disabled = (id == '' || (ltd == '' && full == ''));
}

function on_api_load() {
    acct_list = document.getElementById('acct-list');
    char_list = document.getElementById('char-list');
    api_id = document.getElementById('api-id');
    api_ltd = document.getElementById('api-limited');
    api_full = document.getElementById('api-full');

    acct_list.addEventListener('select', on_acct_select, true);
    acct_list.addEventListener('dblclick', on_acct_dclick, true);

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

    acct_list.startEditing(row.value, col.value);
}

function on_acct_select(aEvt) {
    var row = acct_list.currentIndex;

    if (row == -1) {
        api_id.value = '';
        api_ltd.value = '';
        api_full.value = '';

        api_id.disabled = true;
        api_ltd.disabled = true;
        api_full.disabled = true;
        document.getElementById('btn-check').disabled = true;
        document.getElementById('btn-remove').disabled = true;
        return;
    }

    empty_char_list();

    api_id.value = accts[row].accountID;
    api_ltd.value = accts[row].keyLimited;
    api_full.value = accts[row].keyFull;

    accts[row].getCharacters({}).forEach(function (ch)
        char_list.appendItem(ch.name)
    );

    api_id.disabled = false;
    api_ltd.disabled = false;
    api_full.disabled = false;
    document.getElementById('btn-remove').disabled = false;
    activate_check();
}

function check_data() {
    var row = acct_list.currentIndex;
    if (row == -1)
        return;

    accts[row].accountID = document.getElementById('api-id').value;
    accts[row].keyLimited = document.getElementById('api-limited').value;
    accts[row].keyFull = document.getElementById('api-full').value;

    accts[row].checkLimited(function (ret) {
        if (ret) {
            empty_char_list();

            accts[row].getCharacters({}).forEach(function (ch)
                char_list.appendItem(ch.name)
            );

            accts[row].checkFull(function (ret) {
                if (ret) {
                    dump("Full key is correct!\n");
                } else
                    alert(document.getElementById('wrong-creds').value);
            });
        } else
            alert(document.getElementById('wrong-creds').value);
    });
}

function add_data() {
    accts.push(Cc["@aragaer/eve/account;1"].createInstance(Ci.nsIEveAccount));
    acct_list.view = AcctTreeView;
}

function reload_accts() {
    accts = EveApi.getAccounts();
    acct_list.view = AcctTreeView;
}

function remove_data() {
    var row = acct_list.currentIndex;
    if (row == -1)
        return;

    if (!confirm("Are you sure you want to delete accout '"+accts[row].name+"'?"))
        return;

    accts[row].delete();
    reload_accts();
}
