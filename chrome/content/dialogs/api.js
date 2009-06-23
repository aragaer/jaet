/* Control the 'api keys' window'
 * vim:ts=4:sw=4:expandtab:cindent
 */

const chars = [];
var acct_list, api_id, api_ltd, api_full, char_list;
const AcctTreeView = Cc['@aragaer.com/acct-tree-view;1'].
        getService(Ci.nsITreeView);

function close_api() {
    window.close();
}

function activate_check() {
    var id = api_id.value;
    var ltd = api_ltd.value;

    document.getElementById('btn-check').disabled = (id == '' || ltd == '');
}

function on_api_load() {
    acct_list = document.getElementById('acct-list');
    char_list = document.getElementById('char-list');
    api_id = document.getElementById('api-id');
    api_ltd = document.getElementById('api-limited');
    api_full = document.getElementById('api-full');

    acct_list.addEventListener('select', on_acct_select, true);

    acct_list.apiDB = ApiDB;
    acct_list.view = AcctTreeView; 
}

function empty_char_list() {
    while (char_list.hasChildNodes()) {
        char_list.removeChild(char_list.firstChild);
    }
}

function on_acct_select(aEvt) {
    var row = acct_list.currentIndex;
    println("Acct select "+row);

    if (row == -1) {
        api_id.value = '';
        api_ltd.value = '';
        api_full.value = '';

        api_id.disabled = true;
        api_ltd.disabled = true;
        api_full.disabled = true;
        document.getElementById('btn-check').disabled = true;
        document.getElementById('btn-remove').disabled = true;
        char_list_empty();
        return;
    }
    api_id.value = accts[row].acct_id;
    api_ltd.value = accts[row].ltd;
    api_full.value = accts[row].full;

    load_characters(api_id.value).forEach(function (char) {
        char_list.appendItem(char[0]);
    });

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

    accts[row].acct_id = document.getElementById('api-id').value;
    accts[row].ltd = document.getElementById('api-limited').value;
    accts[row].full = document.getElementById('api-full').value;

    store_keys(accts[row]);
    
    var ret = request_char_list(accts[row].id);
    if (!ret) {
        alert(document.getElementById('wrong-creds').value);
        return;
    }
    empty_char_list();

    ret.forEach(function (char) {
        char_list.appendItem(char[0]);
    });
}

function add_data() {
    add_empty_account();
    acct_list.view = AcctTreeView; 
}

function reload_accts() {
    accts.splice(0);
    get_accounts().forEach(function (a) {
        accts.push(a);
    });
    acct_list.view = AcctTreeView;
}

function remove_data() {
    var row = acct_list.selectedIndex;
    if (row == -1)
        return;

    
}
